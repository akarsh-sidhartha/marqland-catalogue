import React from 'react';

const ContactForm = ({ contacts, setContacts }) => {
  const addContact = () => setContacts([...contacts, { name: '', phone: '', email: '' }]);
  
  const updateContact = (index, field, value) => {
    const newContacts = [...contacts];
    newContacts[index][field] = value;
    setContacts(newContacts);
  };

  const removeContact = (index) => setContacts(contacts.filter((_, i) => i !== index));

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <div className="flex justify-between items-center">
        <label className="font-semibold">Contacts</label>
        <button type="button" onClick={addContact} className="text-blue-600 text-sm">+ Add Contact</button>
      </div>
      {contacts.map((c, i) => (
        <div key={i} className="grid grid-cols-3 gap-2 items-end border-b pb-2">
          <input placeholder="Name" className="border p-1 text-sm" value={c.name} onChange={(e) => updateContact(i, 'name', e.target.value)} />
          <input placeholder="Phone" className="border p-1 text-sm" value={c.phone} onChange={(e) => updateContact(i, 'phone', e.target.value)} />
          <input placeholder="Email" className="border p-1 text-sm" value={c.email} onChange={(e) => updateContact(i, 'email', e.target.value)} />
          {contacts.length > 1 && (
            <button onClick={() => removeContact(i)} className="text-red-500 text-xs text-left">Remove</button>
          )}
        </div>
      ))}
    </div>
  );
};

export default ContactForm;