import { useState } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../supabase';
import NewEntry from './NewEntry';
import Database from './Database';
import { LogOut, PlusCircle, Table, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface CatalogueProps {
  profile: UserProfile;
}

export default function Catalogue({ profile }: CatalogueProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'database'>('new');

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <img 
                src="https://www.ginzalimited.com/cdn/shop/files/Ginza_logo.jpg?v=1668509673&width=500" 
                alt="GINZA Logo" 
                className="h-8 sm:h-10 object-contain flex-shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-xl font-bold text-gray-900 leading-none truncate">Sales Catalogue</h1>
                <p className="text-[8px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider mt-0.5 truncate">Ginza Industries Ltd.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <div className="text-right flex flex-col justify-center bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 shadow-sm">
                <p className="text-[11px] sm:text-sm font-bold text-gray-900 whitespace-nowrap leading-none mb-1 flex items-center justify-end gap-1">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                  {profile.first_name || 'User'} {profile.last_name || ''}
                </p>
                <p className="text-[9px] sm:text-xs text-blue-600 font-bold whitespace-nowrap leading-none uppercase tracking-tight">
                  {profile.unit || 'No Unit'} • {profile.role || 'User'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-xl hover:bg-red-50 border border-gray-100 shadow-sm bg-white"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('new')}
              className={cn(
                "flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all",
                activeTab === 'new' 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <PlusCircle className="w-4 h-4" />
              New Entry
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={cn(
                "flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-all",
                activeTab === 'database' 
                  ? "border-blue-600 text-blue-600" 
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Table className="w-4 h-4" />
              Database
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'new' ? (
          <NewEntry profile={profile} />
        ) : (
          <Database profile={profile} />
        )}
      </main>
    </div>
  );
}
