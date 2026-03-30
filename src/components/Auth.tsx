import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Role, Unit, UNITS, ROLES, UserProfile } from '../types';
import { Loader2, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

interface AuthProps {
  onProfileCreated: (profile: UserProfile) => void;
}

export default function Auth({ onProfileCreated }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    unit: '' as Unit,
    role: '' as Role,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (signInError) throw signInError;
        
        // Fetch profile
        let { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        
        if (profileError) throw profileError;

        // If profile is missing, try to create it from metadata (first login after email confirmation)
        if (!profileData && data.user.user_metadata) {
          const metadata = data.user.user_metadata;
          const newProfile: UserProfile = {
            id: data.user.id,
            first_name: metadata.first_name || '',
            last_name: metadata.last_name || '',
            unit: metadata.unit || '',
            email: data.user.email || '',
            role: metadata.role || '',
          };

          const { error: insertError } = await supabase
            .from('profiles')
            .insert([newProfile]);
          
          if (insertError) {
            console.error('Error auto-creating profile:', insertError);
            // If we can't create it, we still have the metadata, but let's try to proceed
            profileData = newProfile;
          } else {
            profileData = newProfile;
          }
        }
        
        if (!profileData) {
          setError('User profile not found. Please register again or contact administrator.');
          return;
        }
        onProfileCreated(profileData as UserProfile);
      } else {
        if (!formData.unit || !formData.role) {
          throw new Error('Please select unit and role');
        }

        // Sign up with metadata so we can recover the profile later
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
              unit: formData.unit,
              role: formData.role,
            }
          }
        });
        if (signUpError) throw signUpError;
        if (!data.user) throw new Error('Sign up failed');

        const profile: UserProfile = {
          id: data.user.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          unit: formData.unit,
          email: formData.email,
          role: formData.role,
        };

        // Try to insert profile (might fail if email confirmation is required)
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([profile]);
        
        if (profileError) {
          if (profileError.message.includes('row-level security policy')) {
            setSuccess('Registration successful! Please login to your email ID and check your mail and click "Confirm Your Mail" Link to activate your account.');
            return;
          }
          throw profileError;
        }

        if (!data.session) {
          setSuccess('Registration successful! Please login to your email ID and check your mail and click "Confirm Your Mail" Link to activate your account.');
        } else {
          onProfileCreated(profile);
        }
      }
    } catch (err: any) {
      if (err.message.includes('row-level security policy')) {
        setSuccess('Registration successful! Please login to your email ID and check your mail and click "Confirm Your Mail" Link to activate your account.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <img 
            src="https://www.ginzalimited.com/cdn/shop/files/Ginza_logo.jpg?v=1668509673&width=500" 
            alt="GINZA Logo" 
            className="h-16 mx-auto object-contain"
          />
          <h1 className="text-2xl font-bold text-gray-900">Ginza Industries Ltd.</h1>
          <p className="text-gray-500">
            {isLogin ? 'Welcome back! Please login.' : 'Create your account'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm border border-green-100 font-medium leading-relaxed">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">First Name</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Last Name</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email Address</label>
            <input
              required
              type="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-10"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Unit</label>
                <select
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value as Unit })}
                >
                  <option value="" disabled>Select Unit</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <select
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                >
                  <option value="" disabled>Select Role</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="w-5 h-5" /> Login
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" /> Create Account
              </>
            )}
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
