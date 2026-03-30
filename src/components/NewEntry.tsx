import React, { useState } from 'react';
import { supabase } from '../supabase';
import { APPLICATIONS, UserProfile } from '../types';
import { Loader2, Upload, CheckCircle } from 'lucide-react';

interface NewEntryProps {
  profile: UserProfile;
}

export default function NewEntry({ profile }: NewEntryProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    design_no: '',
    content: '',
    gsm: '',
    color: '',
    application: '',
  });

  const DEFAULT_DRIVE_LINK = 'https://drive.google.com/drive/folders/1jRNWW6YGbNlQOHIFY45TgFgmyD2dlSYi?usp=drive_link';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      let image_url = '';
      let storageErrorOccurred = false;

      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `catalogue/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, image);

        if (uploadError) {
          if (uploadError.message.includes('Bucket not found')) {
            throw new Error('Supabase storage bucket "images" was not found. Please create a public bucket named "images" in your Supabase dashboard to enable image storage.');
          } else {
            throw uploadError;
          }
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);
          
          image_url = publicUrl;
        }
      }

      const { error: insertError } = await supabase
        .from('catalogue')
        .insert([{
          ...formData,
          unit: profile.unit,
          image_url,
          author_id: profile.id,
          img_creation_checked: false,
          upload_link: DEFAULT_DRIVE_LINK,
        }]);

      if (insertError) throw insertError;

      setSuccess(true);
      setFormData({
        design_no: '',
        content: '',
        gsm: '',
        color: '',
        application: '',
      });
      setImage(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Create New Entry</h2>
        <p className="text-sm text-gray-500">Adding entry for unit: <span className="font-semibold text-blue-600">{profile.unit}</span></p>
      </div>

      {success && (
        <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-3 border border-green-100">
          <CheckCircle className="w-5 h-5" />
          Entry submitted successfully!
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Design No</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.design_no}
              onChange={(e) => setFormData({ ...formData, design_no: e.target.value })}
              placeholder="e.g. D-101"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Content</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="e.g. 100% Cotton"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">GSM</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.gsm}
              onChange={(e) => setFormData({ ...formData, gsm: e.target.value })}
              placeholder="e.g. 180"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Color</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              placeholder="e.g. Navy Blue"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Application</label>
            <select
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.application}
              onChange={(e) => setFormData({ ...formData, application: e.target.value })}
            >
              <option value="" disabled>Select product</option>
              {APPLICATIONS.map((app) => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Image (Attach Box)</label>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-400 text-center px-4">
                  PNG, JPG or JPEG (MAX. 800x400px)<br/>
                  <span className="text-blue-500 font-medium">Fallback: Google Drive Folder</span>
                </p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          {image && (
            <p className="text-sm text-blue-600 font-medium flex items-center gap-2">
              Selected: {image.name}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-200"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            'Submit Entry'
          )}
        </button>
      </form>
    </div>
  );
}
