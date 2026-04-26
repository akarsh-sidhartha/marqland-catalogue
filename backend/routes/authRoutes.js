const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Invite = require('../models/Invite');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { sendInviteEmail } = require('../services/emailService');

// ─── TOKEN HELPERS ────────────────────────────────────────────────────────────

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status, allowedRoutes: user.allowedRoutes || [] },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Standard self-registration (no invite). Account starts as "pending".
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    if (password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ message: 'An account with this email already exists.' });

    const user = new User({ name, email, password, role: 'viewer', status: 'pending' });
    await user.save();

    res.status(201).json({
      message: 'Registration successful! Your account is pending admin approval.',
      user: { id: user._id, name: user.name, email: user.email, status: user.status }
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed.', error: err.message });
  }
});

/**
 * GET /api/auth/invite/verify?token=xxx
 * Frontend calls this to validate the invite token before showing the form.
 * Returns the pre-filled email so the form can lock it.
 */
router.get('/invite/verify', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Token is required.' });

    const invite = await Invite.findOne({ token, used: false });

    if (!invite)
      return res.status(404).json({ message: 'This invite link is invalid or has already been used.' });

    if (new Date() > invite.expiresAt)
      return res.status(410).json({ message: 'This invite link has expired. Please ask your admin to send a new one.' });

    res.json({ valid: true, email: invite.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/auth/invite/register
 * Register using an invite token. Email is pre-filled and locked from the token.
 */
router.post('/invite/register', async (req, res) => {
  try {
    const { token, name, password } = req.body;

    if (!token || !name || !password)
      return res.status(400).json({ message: 'Token, name, and password are required.' });
    if (password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    // Validate invite
    const invite = await Invite.findOne({ token, used: false });
    if (!invite)
      return res.status(404).json({ message: 'This invite link is invalid or has already been used.' });
    if (new Date() > invite.expiresAt)
      return res.status(410).json({ message: 'This invite link has expired.' });

    // Check email not already taken
    const existing = await User.findOne({ email: invite.email });
    if (existing)
      return res.status(409).json({ message: 'An account with this email already exists.' });

    // Create user (pending — admin still assigns role on approval)
    const user = new User({
      name,
      email: invite.email,
      password,
      role: 'viewer',
      status: 'pending',
    });
    await user.save();

    // Mark invite as used
    invite.used = true;
    await invite.save();

    res.status(201).json({
      message: 'Account created! An admin will activate your account shortly.',
      user: { id: user._id, name: user.name, email: user.email, status: user.status }
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed.', error: err.message });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');

    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid email or password.' });

    if (user.status === 'pending')
      return res.status(403).json({
        message: 'Your account is pending approval. An admin will activate it shortly.',
        status: 'pending'
      });

    if (user.status === 'suspended')
      return res.status(403).json({
        message: 'Your account has been suspended. Please contact your administrator.',
        status: 'suspended'
      });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: 'Login successful.',
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status, allowedRoutes: user.allowedRoutes || [] }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed.', error: err.message });
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token required.' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken)
      return res.status(401).json({ message: 'Invalid refresh token. Please log in again.' });

    if (user.status !== 'active')
      return res.status(403).json({ message: 'Account is not active.' });

    res.json({ accessToken: generateAccessToken(user) });
  } catch (err) {
    res.status(401).json({ message: 'Refresh token expired. Please log in again.' });
  }
});

/**
 * GET /api/auth/me
 * Returns the current user's fresh data from DB (including allowedRoutes).
 * Used by the frontend on mount to pick up any permission changes.
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      allowedRoutes: user.allowedRoutes || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Logout failed.' });
  }
});

/**
 * POST /api/auth/change-password
 * Any logged-in user can change their own password.
 * Requires current password to verify identity first.
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
 
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from your current password.' });
    }
 
    // Fetch user with password field (excluded by default)
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
 
    // Verify current password is correct
    const isCorrect = await user.comparePassword(currentPassword);
    if (!isCorrect) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
 
    // Set new password — the pre('save') hook will hash it automatically
    user.password = newPassword;
    // Invalidate refresh tokens on all devices after password change
    user.refreshToken = null;
    await user.save();
 
    res.json({ message: 'Password changed successfully. Please log in again on other devices.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change password.', error: err.message });
  }
});
 
 
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ADMIN ONLY: Force reset another user's password
 * POST /api/auth/users/:id/reset-password
 *
 * Admin sets a temporary password for an employee who is locked out.
 * Body: { newPassword: 'Temp@1234' }
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.post('/users/:id/reset-password', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { newPassword } = req.body;
 
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }
 
    const user = await User.findById(req.params.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
 
    user.password = newPassword;
    user.refreshToken = null; // Force them to log in fresh
    await user.save();
 
    res.json({
      message: `Password reset for ${user.name}. They must log in with the new password.`,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password.', error: err.message });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/invite
 * Admin sends an invite email to a new employee.
 * Body: { email: 'employee@marqland.com' }
 */
router.post('/invite', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: 'Email address is required.' });

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser)
      return res.status(409).json({ message: `${email} already has an account (status: ${existingUser.status}).` });

    // Check if there's already a pending (unused) invite for this email
    const existingInvite = await Invite.findOne({ email: normalizedEmail, used: false });
    if (existingInvite && new Date() < existingInvite.expiresAt) {
      // Resend the same token instead of creating a new one
      await sendInviteEmail(normalizedEmail, existingInvite.token, req.user.name);
      return res.json({ message: `Invite resent to ${email}.` });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Save invite record
    const invite = new Invite({
      email: normalizedEmail,
      token,
      invitedBy: req.user.id,
    });
    await invite.save();

    // Send the email
    await sendInviteEmail(normalizedEmail, token, req.user.name);

    res.status(201).json({ message: `Invite sent successfully to ${email}.` });
  } catch (err) {
    console.error('Invite Error:', err);
    // Give a friendly message if email sending fails
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      return res.status(500).json({
        message: 'Email authentication failed. Check EMAIL_USER and EMAIL_PASS in your .env file.'
      });
    }
    res.status(500).json({ message: 'Failed to send invite.', error: err.message });
  }
});

/**
 * GET /api/auth/invites
 * Admin: View all pending (unused) invites.
 */
router.get('/invites', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const invites = await Invite.find({ used: false })
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(invites);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/auth/invites/:id
 * Admin: Cancel / revoke a pending invite.
 */
router.delete('/invites/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    await Invite.findByIdAndDelete(req.params.id);
    res.json({ message: 'Invite revoked.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/auth/users
 */
router.get('/users', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/auth/users/pending
 */
router.get('/users/pending', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const users = await User.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PATCH /api/auth/users/:id/approve
 */
router.patch('/users/:id/approve', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'accounts', 'sales', 'inventory', 'courier', 'viewer'];
    if (!role || !validRoles.includes(role))
      return res.status(400).json({ message: `Role must be one of: ${validRoles.join(', ')}` });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'active', role, approvedBy: req.user.id, approvedAt: new Date(), allowedRoutes: [] },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.name} approved as ${role}.`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PATCH /api/auth/users/:id/role
 */
router.patch('/users/:id/role', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'accounts', 'sales', 'inventory', 'courier', 'viewer'];
    if (!role || !validRoles.includes(role))
      return res.status(400).json({ message: `Role must be one of: ${validRoles.join(', ')}` });
    if (req.params.id === req.user.id && role !== 'admin')
      return res.status(400).json({ message: 'You cannot change your own admin role.' });

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.name}'s role updated to ${role}.`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/**
 * PATCH /api/auth/users/:id/routes
 * Set the exact list of routes this user can access (admin-controlled per-user override).
 */
router.patch('/users/:id/routes', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { allowedRoutes } = req.body;
    if (!Array.isArray(allowedRoutes))
      return res.status(400).json({ message: 'allowedRoutes must be an array of strings.' });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { allowedRoutes },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'Route access updated.', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PATCH /api/auth/users/:id/suspend
 */
router.patch('/users/:id/suspend', authenticate, authorize(['admin']), async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ message: 'You cannot suspend your own account.' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'suspended', refreshToken: null },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.name} suspended.`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * PATCH /api/auth/users/:id/reactivate
 */
router.patch('/users/:id/reactivate', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.name} reactivated.`, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/auth/users/:id
 */
router.delete('/users/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ message: 'You cannot delete your own account.' });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `${user.name} deleted.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/auth/forgot-password
 * Public. Sends a reset link to the user's email.
 * Always responds with 200 so we don't reveal if an email is registered.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });
 
    const user = await User.findOne({ email: email.toLowerCase().trim() });
 
    // Always return success — don't reveal whether email exists (security best practice)
    if (!user) {
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }
 
    // Generate a secure reset token (expires in 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
 
    // Store hashed token on user record
    user.passwordResetToken   = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();
 
    // Send email
    const { sendPasswordResetEmail } = require('../services/emailService');
    await sendPasswordResetEmail(user.email, resetToken, user.name);
 
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    // Still return 200 so we don't leak info
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  }
});
 
/**
 * POST /api/auth/reset-password
 * Public. Validates token and sets the new password.
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
 
    if (!token || !newPassword)
      return res.status(400).json({ message: 'Token and new password are required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
 
    // Find user with this token that hasn't expired
    const user = await User.findOne({
      passwordResetToken:   token,
      passwordResetExpires: { $gt: new Date() }, // token still valid
    }).select('+password');
 
    if (!user) {
      return res.status(400).json({
        message: 'This reset link is invalid or has expired. Please request a new one.'
      });
    }
 
    // Set new password — pre('save') hook hashes it automatically
    user.password             = newPassword;
    user.passwordResetToken   = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken         = null; // log out all active sessions
    await user.save();
 
    res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password.', error: err.message });
  }
});


module.exports = router;