import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { User, Shield, Check, X, Search, Mail, Phone, Calendar, ShieldAlert, Trash2, Edit2, Save, UserCheck, UserMinus, MoreVertical, RefreshCw } from 'lucide-react';
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
    <div className="flex-1 flex items-center justify-center bg-[#020617]">
      <div className="flex flex-col items-center gap-4">
        <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Scanning Database...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-[#020617] overflow-hidden h-full text-slate-100">
      {/* Header Area */}
      <div className="p-6 md:p-10 border-b border-white/5 bg-slate-950/50 backdrop-blur-3xl shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Shield className="w-6 h-6 text-emerald-500" />
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Terminal</h1>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Secure Node Administration</p>
          </div>

          <div className="relative w-full md:w-[320px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Query Identity..."
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-inner uppercase tracking-wider"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10 scrollbar-hide">
        <div className="max-w-7xl mx-auto grid grid-cols-1 gap-4 md:gap-6">
          {filteredUsers.map((user) => (
            <motion.div layout key={user.id} className="bg-slate-900/40 backdrop-blur-md rounded-[2rem] border border-white/5 p-5 md:p-8 shadow-xl relative overflow-hidden group">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] bg-slate-800 flex items-center justify-center text-slate-500 font-black text-3xl overflow-hidden shadow-2xl border border-white/5">
                      {user.profile_picture ? <img src={user.profile_picture} alt="" className="w-full h-full object-cover" /> : user.display_name?.[0] || '?'}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-xl border-2 border-[#020617] flex items-center justify-center shadow-lg ${user.role === 'admin' ? 'bg-amber-500' : 'bg-slate-600'}`}>
                      <Shield className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    {editingUser?.id === user.id ? (
                      <input type="text" className="text-xl font-black text-slate-100 border-b-2 border-emerald-500 outline-none mb-1 bg-transparent w-full lowercase tracking-tighter" value={editingUser.display_name} onChange={e => setEditingUser({ ...editingUser, display_name: e.target.value.toLowerCase() })} autoFocus />
                    ) : (
                      <h3 className="text-xl font-black text-slate-100 mb-1 leading-none lowercase tracking-tighter truncate">{user.display_name}</h3>
                    )}
                    <div className="flex flex-col gap-1">
                      {user.email && <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{user.email}</span>}
                      {user.phone && <span className="text-[10px] text-emerald-500/70 font-black uppercase tracking-[0.2em]">{user.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:gap-4 ml-auto lg:ml-0">
                  <div className="flex flex-col items-end mr-2 hidden sm:flex">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Authorization</span>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${user.is_verified ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' : 'bg-red-950/30 text-red-400 border-red-500/20'}`}>{user.is_verified ? 'Verified' : 'Pending'}</span>
                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${user.role === 'admin' ? 'bg-amber-950/30 text-amber-400 border-amber-500/20' : 'bg-white/5 text-slate-500'}`}>{user.role}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {editingUser?.id === user.id ? (
                      <button onClick={() => handleUpdateUser(user.id, { displayName: editingUser.display_name })} className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-xl"><Save className="w-5 h-5" /></button>
                    ) : (
                      <button onClick={() => setEditingUser(user)} className="p-3.5 bg-white/5 text-slate-400 rounded-2xl hover:text-slate-200 border border-white/5 shadow-inner"><Edit2 className="w-5 h-5" /></button>
                    )}
                    <button onClick={() => toggleVerification(user)} className={`p-3.5 rounded-2xl border transition-all ${user.is_verified ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-emerald-600 hover:text-white'}`}><UserCheck className="w-5 h-5" /></button>
                    <button onClick={() => toggleRole(user)} className={`p-3.5 rounded-2xl border transition-all ${user.role === 'admin' ? 'bg-amber-950/30 text-amber-400 border-amber-500/20' : 'bg-white/5 text-slate-500 border-white/5 hover:bg-amber-500 hover:text-white'}`}><Shield className="w-5 h-5" /></button>
                    <button onClick={() => setShowDeleteConfirm(user.id)} className="p-3.5 bg-white/5 text-slate-600 hover:bg-red-950/30 hover:text-red-400 rounded-2xl border border-white/5 transition-all"><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {showDeleteConfirm === user.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 pt-6 border-t border-white/5">
                    <div className="p-6 bg-red-950/20 rounded-2xl border border-red-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-6 h-6 text-red-500" />
                        <p className="text-red-200 font-bold text-[10px] uppercase tracking-widest leading-relaxed">Identity purge will permanently delete all associated encrypted packets.</p>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                        <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-6 py-3 bg-white/5 text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest border border-white/10">Abort</button>
                        <button onClick={() => handleDeleteUser(user.id)} className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-900/40">Execute Purge</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
