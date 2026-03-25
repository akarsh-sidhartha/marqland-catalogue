import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, Paperclip, Send, CheckCircle, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

const VendorResponse = () => {
  const { id } = useParams();
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    companyName: '',
    cost: '',
    deliveryDate: '',
    notes: '',
    attachments: []
  });

  useEffect(() => {
    // Fetch public details and check if active
    axios.get(`/api/inquiries/public/${id}`)
      .then(res => {
        // If the backend returns that it's archived, we set an error
        if (res.data.status === 'archived') {
          setError("This inquiry is no longer accepting responses.");
        } else {
          setInquiry(res.data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Inquiry not found or has been removed.");
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/inquiries/public/${id}/respond`, formData);
      setSubmitted(true);
    } catch (err) {
      alert("Error submitting response. Please try again.");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center font-bold">Loading Inquiry...</div>;
  if (error) return (
    <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
      <AlertCircle size={48} className="text-rose-500 mb-4" />
      <h1 className="text-xl font-black uppercase">{error}</h1>
    </div>
  );

  if (submitted) return (
    <div className="flex h-screen flex-col items-center justify-center p-6 text-center bg-green-50">
      <CheckCircle size={60} className="text-green-500 mb-4" />
      <h1 className="text-2xl font-black uppercase text-green-800">Response Sent!</h1>
      <p className="text-green-600 font-bold mt-2">Marqland Studios has been notified.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b p-6 text-center sticky top-0 z-10 shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-tighter text-slate-800">Marqland Studios</h1>
        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Sourcing Inquiry</p>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-8">
        {/* Inquiry Details Card */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200 mb-6">
          <h2 className="text-xs font-black uppercase text-slate-400 mb-4">Inquiry Details</h2>
          <p className="text-lg font-bold text-slate-800 leading-tight mb-4">{inquiry.publicDescription}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 p-3 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase">Quantity</p>
              <p className="text-sm font-bold text-slate-700">{inquiry.quantity}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase">Required By</p>
              <p className="text-sm font-bold text-slate-700">{inquiry.deadline}</p>
            </div>
          </div>

          {/* Marqland's Attachments */}
          {inquiry.attachments?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Reference Files</p>
              {inquiry.attachments.map((file, idx) => (
                <a key={idx} href={file.url} target="_blank" className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-colors">
                  <ImageIcon size={16} /> View Attachment {idx + 1}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Response Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
            <h3 className="text-sm font-black uppercase mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" /> Your Response
            </h3>
            
            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Company Name</label>
                <input required className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 ring-indigo-500 font-bold" 
                  value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Total Cost (₹)</label>
                  <input required type="number" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 ring-indigo-500 font-bold"
                    value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Can Deliver By</label>
                  <input required type="date" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 ring-indigo-500 font-bold"
                    value={formData.deliveryDate} onChange={e => setFormData({...formData, deliveryDate: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Additional Notes</label>
                <textarea className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 ring-indigo-500 font-bold h-24"
                  value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>

              {/* Voice Note & File Upload */}
              <div className="flex flex-wrap gap-3">
                <button type="button" className="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-100 rounded-2xl font-black text-[10px] uppercase text-slate-600 hover:bg-slate-200">
                  <Mic size={18} className="text-rose-500" /> Send Voice Note
                </button>
                <button type="button" className="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-100 rounded-2xl font-black text-[10px] uppercase text-slate-600 hover:bg-slate-200">
                  <Paperclip size={18} className="text-indigo-500" /> Upload Files
                </button>
              </div>
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-sm mt-8 shadow-2xl shadow-slate-300 flex items-center justify-center gap-3 active:scale-95 transition-transform">
              Submit Response <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VendorResponse;