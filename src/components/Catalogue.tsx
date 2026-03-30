import { useState } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../supabase';
import NewEntry from './NewEntry';
import Database from './Database';
import { LogOut, PlusCircle, Table } from 'lucide-react';
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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <img 
                src="https://www.ginzalimited.com/cdn/shop/files/Ginza_logo.jpg?v=1668509673&width=500" 
                alt="GINZA Logo" 
                className="h-10 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Sales Catalogue</h1>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Ginza Industries Ltd.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">{profile.first_name} {profile.last_name}</p>
                <p className="text-xs text-gray-500">{profile.role} • {profile.unit}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
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
