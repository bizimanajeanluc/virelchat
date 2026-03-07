import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { User, Shield, Check, X, Search, Mail, Phone, Calendar, ShieldAlert, Trash2, Edit2, Save, UserCheck, UserMinus, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Admin: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/users');
      setUsers(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (id: string, updates: any) => {
    try {
      await api.put(`/admin/users/${id}`, updates);
      
      // Map camelCase updates to snake_case for local state consistency
      const stateUpdates: any = { ...updates };
      if (updates.displayName !== undefined) {
        stateUpdates.display_name = updates.displayName;
        delete stateUpdates.displayName;
      }
      if (updates.isVerified !== undefined) {
        stateUpdates.is_verified = updates.isVerified;
        delete stateUpdates.isVerified;
      }

      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...stateUpdates } : u));
      setEditingUser(null);
    } catch (err) {
      alert('Failed to update user');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      setShowDeleteConfirm(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const toggleVerification = (user: any) => {
    handleUpdateUser(user.id, { isVerified: user.is_verified ? 0 : 1 });
  };

  const toggleRole = (user: any) => {
    handleUpdateUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' });
  };

  const filteredUsers = users.filter(u => 
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-stone-500 font-bold">Loading Database...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-stone-50 overflow-hidden h-full">
      <div className="p-6 md:p-10 border-b border-stone-200 bg-white shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-100">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-black text-stone-900 tracking-tight">Admin Terminal</h1>
              </div>
              <p className="text-stone-500 font-medium">Manage users, roles, and system integrity</p>
            </div>

            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search database..."
                className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-[24px] text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-inner"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-6">
            {filteredUsers.map((user) => (
              <motion.div 
                layout
                key={user.id}
                className="bg-white rounded-[32px] border border-stone-200 p-6 md:p-8 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center text-stone-500 font-black text-3xl overflow-hidden shadow-inner border border-stone-100">
                        {user.profile_picture ? (
                          <img src={user.profile_picture} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          user.display_name?.[0] || '?'
                        )}
                      </div>
                      <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-2xl border-4 border-white flex items-center justify-center shadow-sm ${user.role === 'admin' ? 'bg-amber-500' : 'bg-stone-400'}`}>
                        <Shield className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                    
                    <div>
                      {editingUser?.id === user.id ? (
                        <input 
                          type="text"
                          className="text-xl font-black text-stone-900 border-b-2 border-emerald-500 outline-none mb-1 bg-transparent"
                          value={editingUser.display_name}
                          onChange={e => setEditingUser({ ...editingUser, display_name: e.target.value })}
                          autoFocus
                        />
                      ) : (
                        <h3 className="text-xl font-black text-stone-900 mb-1">{user.display_name}</h3>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-3">
                        {user.email && (
                          <span className="flex items-center gap-1.5 text-sm text-stone-500 font-medium">
                            <Mail className="w-3.5 h-3.5 text-stone-300" />
                            {user.email}
                          </span>
                        )}
                        {user.phone && (
                          <span className="flex items-center gap-1.5 text-sm text-stone-500 font-medium">
                            <Phone className="w-3.5 h-3.5 text-stone-300" />
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col items-end mr-4">
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Status</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${user.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {user.is_verified ? 'Verified' : 'Unverified'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${user.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                          {user.role}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {editingUser?.id === user.id ? (
                        <button 
                          onClick={() => handleUpdateUser(user.id, { displayName: editingUser.display_name })}
                          className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                        >
                          <Save className="w-5 h-5" />
                        </button>
                      ) : (
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="p-4 bg-stone-100 text-stone-600 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                          title="Edit Name"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                      )}

                      <button 
                        onClick={() => toggleVerification(user)}
                        className={`p-4 rounded-2xl transition-all ${user.is_verified ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-stone-100 text-stone-600 hover:bg-emerald-600 hover:text-white'}`}
                        title={user.is_verified ? "Unverify User" : "Verify User"}
                      >
                        <UserCheck className="w-5 h-5" />
                      </button>

                      <button 
                        onClick={() => toggleRole(user)}
                        className={`p-4 rounded-2xl transition-all ${user.role === 'admin' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-stone-100 text-stone-600 hover:bg-amber-500 hover:text-white'}`}
                        title={user.role === 'admin' ? "Make Regular User" : "Make Admin"}
                      >
                        <Shield className="w-5 h-5" />
                      </button>

                      <button 
                        onClick={() => setShowDeleteConfirm(user.id)}
                        className="p-4 bg-stone-100 text-stone-400 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all"
                        title="Delete User"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Confirm Delete Overlay */}
                <AnimatePresence>
                  {showDeleteConfirm === user.id && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="mt-6 p-6 bg-red-50 rounded-[24px] border border-red-100 flex flex-col md:flex-row items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-6 h-6 text-red-500" />
                        <p className="text-red-900 font-bold text-sm">Are you absolutely sure? This will permanently delete all messages, keys, and account data for {user.display_name}.</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button 
                          onClick={() => setShowDeleteConfirm(null)}
                          className="px-6 py-2.5 bg-white text-stone-600 rounded-xl font-bold text-sm hover:bg-stone-50 transition-all border border-red-200"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-stone-300" />
              </div>
              <h3 className="text-xl font-bold text-stone-400">No matching users found in the database</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
