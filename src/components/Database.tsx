import { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabase';
import { APPLICATIONS, CatalogueEntry, UserProfile } from '../types';
import { format } from 'date-fns';
import { Calendar, Filter, Search, ExternalLink, Loader2, CheckSquare, Square, CloudUpload, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

declare global {
  interface Window {
    google: any;
  }
}

interface DatabaseProps {
  profile: UserProfile;
}

export default function Database({ profile }: DatabaseProps) {
  const [entries, setEntries] = useState<CatalogueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dynamicApplications, setDynamicApplications] = useState<string[]>(APPLICATIONS);
  const [filters, setFilters] = useState({
    designNo: '',
    application: '',
    startDate: '',
    endDate: '',
  });
  const [selectedEntry, setSelectedEntry] = useState<CatalogueEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<CatalogueEntry>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [newMainImage, setNewMainImage] = useState<File | null>(null);
  const [editSelectedApps, setEditSelectedApps] = useState<string[]>([]);

  useEffect(() => {
    fetchEntries();
    fetchApplications();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('catalogue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catalogue' }, () => {
        fetchEntries();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => {
        fetchApplications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('name')
        .order('name');
      
      if (error) {
        if (error.code === '42P01') return;
        throw error;
      }

      if (data) {
        const customApps = data.map(app => app.name);
        const combined = Array.from(new Set([...APPLICATIONS, ...customApps]));
        setDynamicApplications(combined);
      }
    } catch (err) {
      console.error('Error fetching applications:', err);
    }
  };

  const fetchEntries = async () => {
    try {
      let query = supabase
        .from('catalogue')
        .select('*')
        .order('created_at', { ascending: false });

      if (profile.role !== 'Master') {
        query = query.eq('unit', profile.unit);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEntries(data as CatalogueEntry[]);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTimestamp = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('catalogue')
        .update({
          img_creation_checked: !currentStatus,
          timestamp: !currentStatus ? new Date().toISOString() : null,
          checked_by_name: !currentStatus ? `${profile.first_name} ${profile.last_name}` : null,
        })
        .eq('id', id);
      
      if (error) {
        if (error.message.includes('row-level security policy')) {
          throw new Error('You do not have permission to update this entry. Please check your Supabase RLS policies.');
        }
        if (error.code === '42703') {
          throw new Error('Missing database columns. Please run the SQL update to add "timestamp" and "checked_by_name" columns.');
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Error updating timestamp:', error);
      setError(error.message || 'Failed to update status.');
    }
  };

  const handleEdit = (entry: CatalogueEntry) => {
    setSelectedEntry(entry);
    setEditFormData({
      design_no: entry.design_no,
      content: entry.content,
      gsm: entry.gsm,
      color: entry.color,
      application: entry.application,
    });
    setEditSelectedApps(entry.application ? entry.application.split(', ') : []);
    setIsEditing(true);
  };

  const handleUpdate = async () => {
    if (!selectedEntry) return;
    setEditLoading(true);
    setError(null);

    try {
      let image_url = selectedEntry.image_url;

      if (newMainImage) {
        const fileExt = newMainImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `catalogue/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, newMainImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);
        
        image_url = publicUrl;
      }

      const { error: updateError } = await supabase
        .from('catalogue')
        .update({
          design_no: editFormData.design_no,
          content: editFormData.content,
          gsm: editFormData.gsm,
          color: editFormData.color,
          application: editSelectedApps.join(', '),
          image_url,
        })
        .eq('id', selectedEntry.id);

      if (updateError) throw updateError;

      setIsEditing(false);
      setSelectedEntry(null);
      setNewMainImage(null);
      await fetchEntries();
    } catch (err: any) {
      console.error('Update Error:', err);
      setError(err.message || 'Failed to update entry.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteAdditionalImage = async (urlToDelete: string) => {
    if (!selectedEntry) return;
    try {
      const updatedImages = (selectedEntry.additional_images || []).filter(url => url !== urlToDelete);
      const { error } = await supabase
        .from('catalogue')
        .update({ additional_images: updatedImages })
        .eq('id', selectedEntry.id);
      
      if (error) throw error;
      
      setSelectedEntry({ ...selectedEntry, additional_images: updatedImages });
      await fetchEntries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUploadPhotos = async (entry: CatalogueEntry, files: FileList) => {
    setSyncingId(entry.id);
    setError(null);

    try {
      const newImageUrls: string[] = [...(entry.additional_images || [])];

      // 1. Upload each file to Supabase Storage
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `catalogue/${entry.design_no}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, file);

        if (uploadError) {
          if (uploadError.message.includes('Bucket not found')) {
            throw new Error('Supabase storage bucket "images" was not found. Please create a public bucket named "images" in your Supabase dashboard.');
          } else if (uploadError.message.includes('row-level security policy')) {
            throw new Error('Supabase Storage RLS error: You do not have permission to upload to the "images" bucket. Please add an RLS policy for authenticated users.');
          } else {
            throw uploadError;
          }
        }

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);
        
        newImageUrls.push(publicUrl);
      }

      // 2. Automatically check the box and set timestamp/name/images
      const { error: updateError } = await supabase
        .from('catalogue')
        .update({ 
          img_creation_checked: true,
          timestamp: new Date().toISOString(),
          checked_by_name: `${profile.first_name} ${profile.last_name}`,
          additional_images: newImageUrls
        })
        .eq('id', entry.id);

      if (updateError) {
        if (updateError.message.includes('row-level security policy')) {
          throw new Error('You do not have permission to update this entry. Please check your Supabase RLS policies.');
        }
        if (updateError.code === '42703') {
          throw new Error('Missing database columns. Please run the SQL update to add "timestamp", "checked_by_name", and "additional_images" columns.');
        }
        throw updateError;
      }

      // 3. Refresh entries
      await fetchEntries();
    } catch (err: any) {
      console.error('Upload Error:', err);
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setSyncingId(null);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesDesign = entry.design_no.toLowerCase().includes(filters.designNo.toLowerCase());
    const matchesApp = !filters.application || entry.application === filters.application;
    
    let matchesDate = true;
    if (filters.startDate || filters.endDate) {
      const entryDate = new Date(entry.created_at);
      if (filters.startDate) {
        matchesDate = matchesDate && entryDate >= new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && entryDate <= end;
      }
    }

    return matchesDesign && matchesApp && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Sales Catalogue Database</h2>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase">{profile.unit}</span>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Search className="w-3 h-3" /> Design No
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            placeholder="Search design..."
            value={filters.designNo}
            onChange={(e) => setFilters({ ...filters, designNo: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-3 h-3" /> Application
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            value={filters.application}
            onChange={(e) => setFilters({ ...filters, application: e.target.value })}
          >
            <option value="">All Applications</option>
            {dynamicApplications.map((app) => (
              <option key={app} value={app}>{app}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-3 h-3" /> Start Date
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="w-3 h-3" /> End Date
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sr.No</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Design No</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Content</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">GSM</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Color</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Application</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Images</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Upload</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Img Creation</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Checked By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredEntries.map((entry, index) => (
                <tr 
                  key={entry.id} 
                  className={`transition-colors ${
                    entry.img_creation_checked 
                      ? 'bg-green-50 hover:bg-green-100/80' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{entry.design_no}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{entry.content}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{entry.gsm}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{entry.color}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {entry.application}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-[120px]">
                      {entry.image_url && (
                        <img 
                          src={entry.image_url} 
                          alt={entry.design_no} 
                          className="w-8 h-8 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80"
                          referrerPolicy="no-referrer"
                          onClick={() => setSelectedEntry(entry)}
                        />
                      )}
                      {entry.additional_images?.map((url, i) => (
                        <img 
                          key={i}
                          src={url} 
                          alt={`${entry.design_no}-${i}`} 
                          className="w-8 h-8 object-cover rounded border border-gray-200 cursor-pointer hover:opacity-80"
                          referrerPolicy="no-referrer"
                          onClick={() => setSelectedEntry(entry)}
                        />
                      ))}
                      {!entry.image_url && (!entry.additional_images || entry.additional_images.length === 0) && (
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-[8px] text-center">
                          No Img
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <label 
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold w-full cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      {syncingId === entry.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CloudUpload className="w-3.5 h-3.5" />
                      )}
                      ADD
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        disabled={syncingId === entry.id}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleUploadPhotos(entry, e.target.files);
                          }
                        }}
                      />
                    </label>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleTimestamp(entry.id, !!entry.img_creation_checked)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {entry.img_creation_checked ? (
                        <CheckSquare className="w-6 h-6" />
                      ) : (
                        <Square className="w-6 h-6" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 font-mono">
                    {entry.timestamp ? format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm:ss') : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                    {entry.checked_by_name || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredEntries.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No entries found matching your filters.
          </div>
        )}
      </div>
      
      {/* Image Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200 max-h-[90vh]">
            {/* Image Section */}
            <div className="md:w-2/3 bg-gray-100 flex flex-col items-center p-6 overflow-y-auto">
              <div className="grid grid-cols-1 gap-6 w-full">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Main Image</p>
                    {isEditing && (
                      <label className="text-xs font-bold text-blue-600 cursor-pointer hover:underline">
                        Change Image
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => setNewMainImage(e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>
                  <div className="relative group">
                    <img 
                      src={newMainImage ? URL.createObjectURL(newMainImage) : selectedEntry.image_url} 
                      alt="Main" 
                      className={cn(
                        "w-full object-contain rounded-xl shadow-lg bg-white transition-all",
                        isEditing && "opacity-75"
                      )}
                      referrerPolicy="no-referrer"
                    />
                    {isEditing && newMainImage && (
                      <button 
                        onClick={() => setNewMainImage(null)}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                      >
                        <AlertCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {selectedEntry.additional_images && selectedEntry.additional_images.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase text-gray-400">Additional Photos</p>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedEntry.additional_images.map((url, i) => (
                        <div key={i} className="relative group">
                          <img 
                            src={url} 
                            alt={`Photo ${i + 1}`} 
                            className="w-full h-48 object-cover rounded-xl shadow-md bg-white"
                            referrerPolicy="no-referrer"
                          />
                          {isEditing && (
                            <button 
                              onClick={() => handleDeleteAdditionalImage(url)}
                              className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete this photo"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!selectedEntry.image_url && (!selectedEntry.additional_images || selectedEntry.additional_images.length === 0) && (
                  <div className="text-gray-400 flex flex-col items-center gap-2 py-20">
                    <CloudUpload className="w-12 h-12" />
                    <span>No Images Available</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Details Section */}
            <div className="md:w-1/3 p-8 flex flex-col border-l border-gray-100 bg-white overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-gray-400">Design No</label>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"
                          value={editFormData.design_no}
                          onChange={(e) => setEditFormData({ ...editFormData, design_no: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-3xl font-bold text-gray-900">{selectedEntry.design_no}</h3>
                      <p className="text-blue-600 font-medium">{selectedEntry.application}</p>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setSelectedEntry(null);
                    setIsEditing(false);
                    setNewMainImage(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6 flex-grow">
                <div className="grid grid-cols-1 gap-6">
                  {isEditing ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Content</p>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          value={editFormData.content}
                          onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">GSM</p>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          value={editFormData.gsm}
                          onChange={(e) => setEditFormData({ ...editFormData, gsm: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Color</p>
                        <input 
                          type="text"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          value={editFormData.color}
                          onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Application</p>
                        <div className="grid grid-cols-1 gap-2 p-3 border border-gray-100 rounded-xl bg-gray-50 max-h-40 overflow-y-auto">
                          {dynamicApplications.map((app) => (
                            <label key={app} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input 
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 rounded border-gray-300"
                                checked={editSelectedApps.includes(app)}
                                onChange={(e) => {
                                  if (e.target.checked) setEditSelectedApps([...editSelectedApps, app]);
                                  else setEditSelectedApps(editSelectedApps.filter(a => a !== app));
                                }}
                              />
                              {app}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Content</p>
                        <p className="text-lg text-gray-700 font-medium">{selectedEntry.content}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">GSM</p>
                        <p className="text-lg text-gray-700 font-medium">{selectedEntry.gsm}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Color</p>
                        <p className="text-lg text-gray-700 font-medium">{selectedEntry.color}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Unit</p>
                        <p className="text-lg text-gray-700 font-medium">{selectedEntry.unit}</p>
                      </div>
                    </>
                  )}
                </div>

                {!isEditing && (
                  <div className="pt-6 border-t border-gray-100">
                    <div className="space-y-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-gray-400">Created At</span>
                        <span className="text-sm text-gray-600">{format(new Date(selectedEntry.created_at), 'PPP p')}</span>
                      </div>
                      {selectedEntry.img_creation_checked && (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase text-gray-400">Checked By</span>
                          <span className="text-sm text-green-600 font-bold">{selectedEntry.checked_by_name}</span>
                          <span className="text-xs text-gray-400">{selectedEntry.timestamp && format(new Date(selectedEntry.timestamp), 'PPP p')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                {isEditing ? (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setIsEditing(false);
                        setNewMainImage(null);
                      }}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleUpdate}
                      disabled={editLoading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {editLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                    </button>
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => handleEdit(selectedEntry)}
                      className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-3 px-6 rounded-xl transition-all border border-blue-100"
                    >
                      Edit Details
                    </button>
                    <button 
                      onClick={() => setSelectedEntry(null)}
                      className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
