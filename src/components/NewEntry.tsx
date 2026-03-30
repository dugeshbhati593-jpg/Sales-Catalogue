import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { APPLICATIONS, UserProfile } from '../types';
import { Loader2, Upload, CheckCircle, Plus, X, Save } from 'lucide-react';
import { cn } from '../lib/utils';

interface NewEntryProps {
  profile: UserProfile;
}

export default function NewEntry({ profile }: NewEntryProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [dynamicApplications, setDynamicApplications] = useState<string[]>(APPLICATIONS);
  const [isAddingApp, setIsAddingApp] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [addingAppLoading, setAddingAppLoading] = useState(false);

  const [selectedApplications, setSelectedApplications] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    design_no: '',
    content: '',
    gsm: '',
    color: '',
  });

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('name')
        .order('name');
      
      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist yet, just use defaults
          return;
        }
        throw error;
      }

      if (data) {
        const customApps = data.map(app => app.name);
        // Combine defaults with custom apps, removing duplicates
        const combined = Array.from(new Set([...APPLICATIONS, ...customApps]));
        setDynamicApplications(combined);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
    }
  };

  const handleAddApplication = async () => {
    if (!newAppName.trim()) return;
    setAddingAppLoading(true);
    try {
      const { error } = await supabase
        .from('applications')
        .insert([{ name: newAppName.trim() }]);
      
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Applications table not found. Please create it in Supabase SQL Editor first.');
        }
        throw error;
      }

      setNewAppName('');
      setIsAddingApp(false);
      await fetchApplications();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingAppLoading(false);
    }
  };

  const DEFAULT_DRIVE_LINK = 'https://drive.google.com/drive/folders/1jRNWW6YGbNlQOHIFY45TgFgmyD2dlSYi?usp=drive_link';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (selectedApplications.length === 0) {
      setError('Please select at least one application.');
      setLoading(false);
      return;
    }

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
          application: selectedApplications.join(', '),
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
      });
      setSelectedApplications([]);
      setImage(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Create New Entry</h2>
          <p className="text-sm text-gray-500">Add a new catalogue entry below.</p>
        </div>
        <div className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Active Unit</p>
          <p className="text-sm font-bold text-blue-700">{profile.unit}</p>
        </div>
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Applications (Multiple Selection)</label>
              {!isAddingApp ? (
                <button
                  type="button"
                  onClick={() => setIsAddingApp(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                >
                  <Plus className="w-3 h-3" /> Add New
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingApp(false)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 px-2 py-1 rounded"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              )}
            </div>
            
            {isAddingApp ? (
              <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200 mb-4">
                <input
                  type="text"
                  className="flex-grow px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Enter new application name..."
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  disabled={addingAppLoading}
                  onClick={handleAddApplication}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {addingAppLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 p-3 border border-gray-200 rounded-xl bg-gray-50 max-h-64 overflow-y-auto shadow-inner">
                {dynamicApplications.map((app) => (
                  <label 
                    key={app} 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer text-sm",
                      selectedApplications.includes(app)
                        ? "bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-white"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-transform active:scale-90"
                      checked={selectedApplications.includes(app)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedApplications([...selectedApplications, app]);
                        } else {
                          setSelectedApplications(selectedApplications.filter(a => a !== app));
                        }
                      }}
                    />
                    <span className="flex-1">{app}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedApplications.length > 0 && !isAddingApp && (
              <p className="mt-2 text-xs text-blue-600 font-medium">
                Selected: {selectedApplications.join(', ')}
              </p>
            )}
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
