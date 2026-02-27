import React, { useState, useEffect, useRef } from 'react';
import { User, CheckCircle, Save, ChevronDown, Search, Calendar, History, Filter, AlertCircle, XCircle, Clock, X, Check, Database, Edit, AlertTriangle, ArrowLeft, RefreshCw, Trash2, Eraser } from 'lucide-react';
import { StudentProfile } from '../types';
import { updateStudentAttendance, recalculateStudentAttendance } from '../firebase/studentService';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';

interface AttendanceStudent {
  id: string;
  name: string;
  nim: string;
  gender: 'L' | 'P';
  initials: string;
  color: string;
  status: 'H' | 'I' | 'S' | 'A' | null;
  note: string;
  batch: string;
  major: string;
}

// Interface for the History feature
interface AttendanceLog {
  id: string;
  date: string;
  studentName: string;
  nim: string;
  status: 'H' | 'I' | 'S' | 'A';
  note: string;
  avatarColor: string;
  initials: string;
  batch: string;
}

function attendanceStatusFromPct(pct: number): 'Excellent' | 'Good' | 'Warning' | 'Critical' {
  if (pct >= 95) return 'Excellent';
  if (pct >= 85) return 'Good';
  if (pct >= 70) return 'Warning';
  return 'Critical';
}

interface AttendanceProps {
  students: StudentProfile[];
  initialTab?: 'input' | 'history';
  initialViewMode?: 'issues' | 'all';
  onAttendanceSaved?: () => Promise<void>;
}

export const Attendance: React.FC<AttendanceProps> = ({ students: sourceStudents, initialTab, initialViewMode, onAttendanceSaved }) => {
  const [activeTab, setActiveTab] = useState<'input' | 'history'>('input');
  const [currentStudents, setCurrentStudents] = useState<StudentProfile[]>(sourceStudents);
  
  // Input State (local copy for today's attendance input)
  const [inputStudents, setInputStudents] = useState<AttendanceStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBatch, setSelectedBatch] = useState('All Batch');
  const [selectedMajor, setSelectedMajor] = useState('All Majors');

  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [showEditDateModal, setShowEditDateModal] = useState(false);
  const [editDateInput, setEditDateInput] = useState('');
  
  // History & Deletion State
  const [historyData, setHistoryData] = useState<AttendanceLog[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyViewMode, setHistoryViewMode] = useState<'issues' | 'all'>('all'); 
  const [historyBatchFilter, setHistoryBatchFilter] = useState('All');
  const [historyDateFilter, setHistoryDateFilter] = useState(''); // New: Filter for Bulk Delete

  // Delete Modals
  const [deleteConfirmType, setDeleteConfirmType] = useState<'single' | 'bulk' | null>(null);
  const [itemToDelete, setItemToDelete] = useState<AttendanceLog | null>(null); // For single delete

  // Modal State for Viewing Proof


  // Success Save State
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [saveStats, setSaveStats] = useState({ total: 0, h: 0, i: 0, s: 0, a: 0 });

  // Handle Initial Props
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    if (initialViewMode) setHistoryViewMode(initialViewMode);
    setCurrentStudents(sourceStudents);
  }, [initialTab, initialViewMode, sourceStudents]);

  useEffect(() => {
    const formatted: AttendanceStudent[] = currentStudents.map((s: StudentProfile) => ({
      id: s.id,
      name: s.name,
      nim: s.nim,
      gender: s.gender === 'Male' ? 'L' : 'P',
      initials: s.initials,
      color: s.color,
      status: null,
      note: '',
      batch: s.batch,
      major: s.major
    }));
    setInputStudents(formatted);
  }, [currentStudents]);

  // Load history dari Firestore
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const q = query(collection(db, 'attendanceLogs'), orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        const logs: AttendanceLog[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            date: (data.date as string) ?? '',
            studentName: (data.studentName as string) ?? '',
            nim: (data.nim as string) ?? '',
            status: (data.status as 'H' | 'I' | 'S' | 'A'),
            note: (data.note as string) ?? '',
            avatarColor: (data.avatarColor as string) ?? 'blue',
            initials: (data.initials as string) ?? '',
            batch: (data.batch as string) ?? '',
          };
        });
        setHistoryData(logs);
      } catch (error) {
        console.error('Gagal memuat history absensi:', error);
      }
    };

    loadHistory();
  }, []);

  /** Refetch students data dari Firestore untuk sync terbaru */
  const refreshStudentsData = async () => {
    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);
      const refreshedStudents: StudentProfile[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: (data.name as string) ?? '',
          nim: (data.nim as string) ?? '',
          major: (data.major as string) ?? '',
          batch: (data.batch as string) ?? '',
          gpa: (data.gpa as number) ?? 0,
          status: (data.status as 'Active' | 'Inactive' | 'Graduated') ?? 'Active',
          avatarUrl: (data.avatarUrl as string) ?? '',
          email: (data.email as string) ?? '',
          phone: (data.phone as string) ?? '',
          gender: (data.gender as 'Male' | 'Female') ?? 'Male',
          initials: (data.initials as string) ?? '',
          color: (data.color as any) ?? 'blue',
          h: (data.h as number) ?? 0,
          i: (data.i as number) ?? 0,
          s: (data.s as number) ?? 0,
          a: (data.a as number) ?? 0,
          pct: (data.pct as number) ?? 0,
          attendanceStatus: (data.attendanceStatus as any) ?? 'Excellent',
          totalCredits: (data.totalCredits as number) ?? 0,
          targetCredits: (data.targetCredits as number) ?? 144,
          achievementCount: (data.achievementCount as number) ?? 0,
          disciplinePoints: (data.disciplinePoints as number) ?? 0,
          tuitionStatus: (data.tuitionStatus as any) ?? 'Paid',
          tuitionDate: (data.tuitionDate as string) ?? '',
          economicTier: (data.economicTier as 1|2|3|4|5) ?? 3,
          isScholarship: (data.isScholarship as boolean) ?? false,
          goodStandingNote: (data.goodStandingNote as string) ?? '',
          records: (data.records as any[]) ?? [],
          academicHistory: (data.academicHistory as any[]) ?? []
        };
      });
      setCurrentStudents(refreshedStudents);
    } catch (error) {
      console.error('Gagal me-refresh students data:', error);
    }
  };

  const resetStudentData = () => {
    const formatted: AttendanceStudent[] = currentStudents.map((s: StudentProfile) => ({
      id: s.id,
      name: s.name,
      nim: s.nim,
      gender: s.gender === 'Male' ? 'L' : 'P',
      initials: s.initials,
      color: s.color,
      status: null,
      note: '',
      batch: s.batch,
      major: s.major
    }));
    setInputStudents(formatted);
  };

  const handleStatusChange = (id: string, status: 'H' | 'I' | 'S' | 'A') => {
    setInputStudents(inputStudents.map(s =>
      s.id === id ? { ...s, status, note: status === 'H' ? '' : s.note } : s
    ));
  };

  const handleNoteChange = (id: string, note: string) => {
    setInputStudents(inputStudents.map(s => s.id === id ? { ...s, note } : s));
  };

  const handleBulkSet = () => {
    const visibleIds = new Set(filteredStudents.map(s => s.id));
    setInputStudents(inputStudents.map(s => 
      visibleIds.has(s.id) && s.status === null ? { ...s, status: 'H' } : s
    ));
  };

  const handleSaveAttendance = async () => {
    const stats = inputStudents.reduce((acc, curr) => {
      if (curr.status) {
        acc.total++;
        if (curr.status === 'H') acc.h++;
        if (curr.status === 'I') acc.i++;
        if (curr.status === 'S') acc.s++;
        if (curr.status === 'A') acc.a++;
      }
      return acc;
    }, { total: 0, h: 0, i: 0, s: 0, a: 0 });

    if (stats.total === 0) {
      alert('No attendance data to save. Please mark student attendance first.');
      return;
    }

    // STEP 1: Simpan setiap log ke attendanceLogs (collection terpisah dari students)
    const savedLogs: AttendanceLog[] = [];
    try {
      const logsRef = collection(db, 'attendanceLogs');
      for (const row of inputStudents) {
        if (!row.status) continue;
        const newDocRef = doc(logsRef);
        await setDoc(newDocRef, {
          date: selectedDate,
          studentName: row.name,
          nim: row.nim,
          status: row.status,
          note: row.note ?? '',
          avatarColor: row.color,
          initials: row.initials,
          batch: row.batch,
          savedAt: serverTimestamp()
        });
        savedLogs.push({
          id: newDocRef.id,
          date: selectedDate,
          studentName: row.name,
          nim: row.nim,
          status: row.status,
          note: row.note ?? '',
          avatarColor: row.color,
          initials: row.initials,
          batch: row.batch
        });
      }
    } catch (error) {
      console.error('Gagal menyimpan log ke Firestore:', error);
      alert('Gagal menyimpan absensi. Pastikan Anda sudah login.');
      return;
    }

    // STEP 2: Recalculate statistik dari attendanceLogs (BUKAN increment manual)
    // Hitung ulang dari database = selalu akurat, tidak peduli berapa kali save
    const affectedRows = inputStudents.filter(s => s.status !== null);
    for (const row of affectedRows) {
      try {
        await recalculateStudentAttendance(row.nim, row.id);
      } catch (err) {
        console.error('Gagal recalculate stats untuk', row.name, err);
      }
    }

    // STEP 3: Tampilkan modal sukses DULU sebelum apapun
    setHistoryData(prev => [...savedLogs, ...prev]);
    setHistoryViewMode('all');
    setSaveStats(stats);
    setShowSaveSuccess(true);

    // STEP 4: Refresh students di background (tidak di-await agar modal tidak tertutup)
    if (onAttendanceSaved) {
      onAttendanceSaved().catch(err => console.error('Gagal refresh students:', err));
    }
  };

  // --- EDIT MODE LOGIC ---
  const handleOpenEditModal = () => {
      setShowEditDateModal(true);
      setEditDateInput(new Date().toISOString().split('T')[0]);
  };

  const handleLoadAttendanceForEdit = () => {
      setShowEditDateModal(false);
      setIsEditMode(true);
      setSelectedDate(editDateInput);
      setActiveTab('input'); // Force switch to input view

      // SIMULATE FETCHING DATA FROM DB FOR SELECTED DATE
      const mockFetchedData = inputStudents.map(s => {
          const rand = Math.random();
          let status: 'H' | 'I' | 'S' | 'A' = 'H';
          if (rand > 0.85) status = 'I';
          else if (rand > 0.90) status = 'S';
          else if (rand > 0.95) status = 'A';
          
          return {
              ...s,
              status: status,
              note: status === 'I' || status === 'S' ? 'Pre-existing note from DB' : ''
          };
      });
      setInputStudents(mockFetchedData);
  };

  const handleCancelEditMode = () => {
      setIsEditMode(false);
      resetStudentData(); // Reset to empty for fresh input
      setSelectedDate(new Date().toISOString().split('T')[0]); // Reset date to today
  };

  // --- DELETE LOGIC ---
  const initiateSingleDelete = (log: AttendanceLog) => {
      setItemToDelete(log);
      setDeleteConfirmType('single');
  };

  const initiateBulkDelete = () => {
      if (!historyDateFilter) return;
      setDeleteConfirmType('bulk');
  };

  const confirmDelete = async () => {
      // === SINGLE DELETE ===
      if (deleteConfirmType === 'single' && itemToDelete) {
          try {
            // Step 1: Delete from attendanceLogs
            await deleteDoc(doc(db, 'attendanceLogs', itemToDelete.id));

            // Step 2: Kurangi statistik attendance dari student
            const studentWithLog = sourceStudents.find(s => s.nim === itemToDelete.nim);
            if (studentWithLog) {
              let h = studentWithLog.h;
              let i = studentWithLog.i;
              let s = studentWithLog.s;
              let a = studentWithLog.a;
              
              // Kurangi berdasarkan status log yang dihapus
              if (itemToDelete.status === 'H') h = Math.max(0, h - 1);
              else if (itemToDelete.status === 'I') i = Math.max(0, i - 1);
              else if (itemToDelete.status === 'S') s = Math.max(0, s - 1);
              else if (itemToDelete.status === 'A') a = Math.max(0, a - 1);
              
              // Hitung ulang percentage dan status
              const total = h + i + s + a;
              const pct = total > 0 ? Math.round((h / total) * 1000) / 10 : 100;
              const attendanceStatus = attendanceStatusFromPct(pct);
              
              // Update student di Firestore
              await updateStudentAttendance(studentWithLog.id, { h, i, s, a, pct, attendanceStatus });
            }
            
            setHistoryData(prev => prev.filter(item => item.id !== itemToDelete.id));
          } catch (error) {
            console.error('Gagal menghapus log:', error);
          }
      } 
      // === BULK DELETE ===
      else if (deleteConfirmType === 'bulk' && historyDateFilter) {
          const toDelete = historyData.filter(h => h.date === historyDateFilter);
          try {
            // Step 1: Hapus dari attendanceLogs dengan batch
            const batch = writeBatch(db);
            toDelete.forEach(log => {
              batch.delete(doc(db, 'attendanceLogs', log.id));
            });
            await batch.commit();

            // Step 2: Update statistik untuk semua student yang affected
            // Group logs by NIM
            const logsByNim = new Map<string, AttendanceLog[]>();
            toDelete.forEach(log => {
              if (!logsByNim.has(log.nim)) {
                logsByNim.set(log.nim, []);
              }
              logsByNim.get(log.nim)!.push(log);
            });

            // Update setiap student
            for (const [nim, logs] of logsByNim.entries()) {
              const studentWithLogs = sourceStudents.find(s => s.nim === nim);
              if (!studentWithLogs) continue;
              
              let h = studentWithLogs.h;
              let i = studentWithLogs.i;
              let s = studentWithLogs.s;
              let a = studentWithLogs.a;
              
              // Kurangi counts berdasarkan logs yang dihapus
              logs.forEach(log => {
                if (log.status === 'H') h = Math.max(0, h - 1);
                else if (log.status === 'I') i = Math.max(0, i - 1);
                else if (log.status === 'S') s = Math.max(0, s - 1);
                else if (log.status === 'A') a = Math.max(0, a - 1);
              });
              
              // Hitung ulang percentage dan status
              const total = h + i + s + a;
              const pct = total > 0 ? Math.round((h / total) * 1000) / 10 : 100;
              const attendanceStatus = attendanceStatusFromPct(pct);
              
              // Update student di Firestore
              await updateStudentAttendance(studentWithLogs.id, { h, i, s, a, pct, attendanceStatus });
            }
            
            setHistoryData(prev => prev.filter(item => item.date !== historyDateFilter));
          } catch (error) {
            console.error('Gagal bulk delete:', error);
          }
      }
      setDeleteConfirmType(null);
      setItemToDelete(null);
  };

  // ----------------------

  // Filter Logic for Input View
  const filteredStudents = inputStudents.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          student.nim.includes(searchTerm);
    const matchesBatch = selectedBatch === 'All Batch' || student.batch === selectedBatch;
    const matchesMajor = selectedMajor === 'All Majors' || student.major === selectedMajor;
    return matchesSearch && matchesBatch && matchesMajor;
  });

  // Filter Logic for History View
  const filteredHistory = historyData.filter(log => {
      const matchesSearch = log.studentName.toLowerCase().includes(historySearch.toLowerCase()) || log.nim.includes(historySearch);
      const matchesBatch = historyBatchFilter === 'All' || log.batch === historyBatchFilter;
      const matchesDate = !historyDateFilter || log.date === historyDateFilter; // Date filter logic

      let matchesView = true;
      if (historyViewMode === 'issues') {
          matchesView = log.status !== 'H';
      }

      return matchesSearch && matchesBatch && matchesView && matchesDate;
  });

  // Calculate Stats
  const historyStats = historyData.reduce((acc, curr) => {
      acc.total++;
      if (curr.status === 'H') acc.h++;
      if (curr.status === 'I') acc.i++;
      if (curr.status === 'S') acc.s++;
      if (curr.status === 'A') acc.a++;
      return acc;
  }, { total: 0, h: 0, i: 0, s: 0, a: 0 });


  const getAvatarColor = (color: string) => {
      const colors: any = {
          blue: 'bg-blue-100 text-blue-600',
          purple: 'bg-purple-100 text-purple-600',
          orange: 'bg-orange-100 text-orange-600',
          teal: 'bg-teal-100 text-teal-600',
          red: 'bg-red-100 text-red-600',
          indigo: 'bg-indigo-100 text-indigo-600',
          green: 'bg-emerald-100 text-emerald-600'
      };
      return colors[color] || colors.blue;
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'H': return <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Hadir</span>;
          case 'I': return <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Izin</span>;
          case 'S': return <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3" /> Sakit</span>;
          case 'A': return <span className="px-2.5 py-1 rounded bg-red-50 text-red-700 text-xs font-bold border border-red-200 flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Alpha</span>;
          default: return null;
      }
  };

  // Helper component for the styled radio button
  const RadioOption = ({ studentId, value, label, currentStatus, colorClass, bgClass, borderClass, activeBgClass }: any) => (
    <div className="relative">
      <input
        type="radio"
        name={`att_${studentId}`}
        id={`${value.toLowerCase()}_${studentId}`}
        className="peer sr-only"
        checked={currentStatus === value}
        onChange={() => handleStatusChange(studentId, value)}
      />
      <label
        htmlFor={`${value.toLowerCase()}_${studentId}`}
        className={`w-8 h-8 rounded-full border ${borderClass} ${colorClass} hover:${bgClass} flex items-center justify-center text-xs font-bold cursor-pointer transition-all peer-checked:scale-110 peer-checked:font-bold peer-checked:text-white peer-checked:border-transparent ${currentStatus === value ? activeBgClass : ''}`}
      >
        {label}
      </label>
    </div>
  );

  return (
    <div className="w-full space-y-6 pb-20 relative">
       
       {/* DELETE CONFIRMATION MODAL */}
       {deleteConfirmType && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-slate-100">
                    <div className="flex items-center gap-3 mb-4 text-red-600">
                        <div className="p-2 bg-red-100 rounded-full">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900">Confirm Deletion</h3>
                    </div>
                    
                    <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                        {deleteConfirmType === 'single' 
                            ? <span>Are you sure you want to delete the attendance record for <span className="font-bold text-slate-900">{itemToDelete?.studentName}</span>?</span>
                            : <span>Are you sure you want to delete <span className="font-bold text-red-600 underline">ALL RECORDS</span> for <span className="font-bold text-slate-900">{historyDateFilter}</span>? This action cannot be undone.</span>
                        }
                    </p>
                    
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => { setDeleteConfirmType(null); setItemToDelete(null); }}
                            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm shadow-red-200 flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Yes, Delete
                        </button>
                    </div>
                </div>
            </div>
       )}

       {/* Date Selection Modal for Editing */}
       {showEditDateModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
               <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 border border-slate-100">
                   <div className="flex items-center gap-3 mb-4">
                       <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                           <Edit className="w-6 h-6" />
                       </div>
                       <h3 className="font-bold text-lg text-slate-900">Edit Past Attendance</h3>
                   </div>
                   <p className="text-sm text-slate-500 mb-4">Select the date you want to correct. Current data will be loaded for modification.</p>
                   
                   <div className="space-y-4">
                       <div>
                           <label className="block text-xs font-medium text-slate-700 mb-1.5">Select Date</label>
                           <input 
                                type="date" 
                                value={editDateInput}
                                onChange={(e) => setEditDateInput(e.target.value)}
                                className="w-full rounded-lg h-10 border border-slate-300 bg-white text-slate-900 text-sm px-3 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none"
                           />
                       </div>
                   </div>

                   <div className="flex gap-2 mt-6">
                       <button 
                            onClick={() => setShowEditDateModal(false)}
                            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                       >
                           Cancel
                       </button>
                       <button 
                            onClick={handleLoadAttendanceForEdit}
                            className="flex-1 py-2.5 rounded-lg bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-colors shadow-sm shadow-amber-200"
                       >
                           Load Data
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* Success Save Modal */}
       {showSaveSuccess && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center animate-in zoom-in-95 duration-200 border border-slate-100">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isEditMode ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                         {isEditMode ? <RefreshCw className="w-8 h-8" /> : <Check className="w-8 h-8" strokeWidth={3} />}
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{isEditMode ? 'Corrections Saved!' : 'Attendance Saved!'}</h2>
                    <p className="text-slate-500 mb-6">
                        {isEditMode 
                            ? <span>Adjustments for <span className="font-semibold text-slate-900">{selectedDate}</span> have been updated.</span> 
                            : <span>Data for <span className="font-semibold text-slate-900">{selectedDate}</span> has been successfully recorded.</span>
                        }
                    </p>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><CheckCircle className="w-4 h-4" /></div>
                            <div className="text-left">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Present</p>
                                <p className="text-lg font-bold text-slate-900">{saveStats.h}</p>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Clock className="w-4 h-4" /></div>
                            <div className="text-left">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Permit</p>
                                <p className="text-lg font-bold text-slate-900">{saveStats.i}</p>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><AlertCircle className="w-4 h-4" /></div>
                            <div className="text-left">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Sick</p>
                                <p className="text-lg font-bold text-slate-900">{saveStats.s}</p>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg text-red-600"><XCircle className="w-4 h-4" /></div>
                            <div className="text-left">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Alpha</p>
                                <p className="text-lg font-bold text-slate-900">{saveStats.a}</p>
                            </div>
                        </div>
                    </div>

                    {/* Database Connection Status Simulator */}
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-6 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <Database className="w-3 h-3" />
                        <span>Database Connection: <span className="text-emerald-600 font-bold">Stable & Synced</span></span>
                    </div>

                    <button 
                        onClick={() => { setShowSaveSuccess(false); if(isEditMode) handleCancelEditMode(); }}
                        className={`w-full py-3 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98] ${isEditMode ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-primary hover:bg-blue-600 shadow-blue-200'}`}
                    >
                        {isEditMode ? 'Return to Input Mode' : 'Continue Work'}
                    </button>
                </div>
            </div>
       )}

       {/* Header */}
       <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold leading-tight text-slate-900">Attendance Manager</h2>
          <p className="text-slate-500 text-sm">Manage daily attendance and view historical records.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
             <User className="text-slate-500 w-6 h-6" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-900">Admin User</p>
            <p className="text-xs text-slate-500">Faculty of Engineering</p>
          </div>
        </div>
      </div>

      {/* Main Tab Switcher & Edit Action */}
      <div className="flex justify-between items-center">
          {!isEditMode ? (
              <div className="bg-white p-1 rounded-xl border border-slate-200 inline-flex shadow-sm">
                <button 
                    onClick={() => setActiveTab('input')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'input' ? 'bg-[#135bec] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <CheckCircle className="w-4 h-4" />
                    Daily Input
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-[#135bec] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <History className="w-4 h-4" />
                    History Log
                </button>
              </div>
          ) : (
              <div className="flex items-center gap-2 text-slate-500">
                  <span className="text-sm font-semibold">Mode: </span>
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200 flex items-center gap-1">
                      <Edit className="w-3 h-3" />
                      EDITING HISTORY
                  </span>
              </div>
          )}

          {!isEditMode && (
              <button 
                onClick={handleOpenEditModal}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 rounded-lg text-sm font-bold transition-all shadow-sm group"
              >
                  <Edit className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Edit Past Attendance
              </button>
          )}
      </div>

      {/* EDIT MODE BANNER */}
      {isEditMode && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                      <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                      <h3 className="font-bold text-amber-900 text-sm">You are editing attendance records for <span className="underline decoration-amber-400/50 decoration-2">{selectedDate}</span></h3>
                      <p className="text-xs text-amber-700/80">Changes made here will overwrite previous data. Make sure to double-check before saving.</p>
                  </div>
              </div>
              <button 
                onClick={handleCancelEditMode}
                className="px-4 py-2 bg-white border border-amber-200 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-2"
              >
                  <ArrowLeft className="w-3 h-3" />
                  Cancel Editing
              </button>
          </div>
      )}

      {/* --- INPUT VIEW (Used for both New Input and Editing) --- */}
      {activeTab === 'input' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Filters */}
            <div className={`flex flex-col xl:flex-row gap-4 items-end xl:items-center justify-between bg-white p-4 rounded-xl border shadow-sm ${isEditMode ? 'border-amber-200 shadow-amber-50' : 'border-slate-200'}`}>
                <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto flex-1 flex-wrap">
                    <div className="w-full md:w-56">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Search Student</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="w-4 h-4 text-slate-400" />
                            </div>
                            <input 
                                type="text"
                                placeholder="Name or NIM..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-lg h-10 border border-slate-200 bg-[#f6f6f8] text-slate-900 text-sm pl-9 pr-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                    
                    {/* Date Filter (Disabled in Edit Mode) */}
                    <div className="w-full md:w-40">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Date</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Calendar className="w-4 h-4 text-slate-500" />
                            </div>
                            <input 
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                disabled={isEditMode}
                                className={`w-full rounded-lg h-10 border border-slate-200 bg-[#f6f6f8] text-slate-900 text-sm pl-10 pr-3 outline-none transition-all ${isEditMode ? 'cursor-not-allowed opacity-70' : 'focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 cursor-pointer'}`}
                            />
                        </div>
                    </div>

                    {/* Major Filter */}
                    <div className="w-full md:w-48">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Major</label>
                        <div className="relative">
                            <select 
                                value={selectedMajor}
                                onChange={(e) => setSelectedMajor(e.target.value)}
                                className="w-full appearance-none rounded-lg h-10 border border-slate-200 bg-[#f6f6f8] text-slate-900 text-sm px-3 pr-8 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none cursor-pointer"
                            >
                                <option>All Majors</option>
                                <option>Lalu Lintas Udara</option>
                                <option>Komunikasi Penerbangan</option>
                                <option>Manajemen Transportasi Udara</option>
                                <option>Teknik Bangunan Landasan</option>
                                <option>Teknik Listrik Bandara</option>
                                <option>Teknik Navigasi Udara</option>
                                <option>Teknik Pesawat Udara</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    {/* Batch Filter */}
                    <div className="w-full md:w-32">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Batch</label>
                        <div className="relative">
                            <select 
                                value={selectedBatch}
                                onChange={(e) => setSelectedBatch(e.target.value)}
                                className="w-full appearance-none rounded-lg h-10 border border-slate-200 bg-[#f6f6f8] text-slate-900 text-sm px-3 pr-8 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none cursor-pointer"
                            >
                                <option>All Batch</option>
                                <option>15</option>
                                <option>16</option>
                                <option>17</option>
                                <option>18</option>
                                <option>19</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-xl border ${isEditMode ? 'bg-amber-50 border-amber-200' : 'bg-blue-50/50 border-blue-100'}`}>
                <div className="text-sm text-slate-600">
                    Showing <span className="font-bold text-slate-900">{filteredStudents.length}</span> students for {isEditMode ? 'editing' : 'input'}
                </div>
                <div className="flex gap-3">
                <button 
                    onClick={handleBulkSet}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Set All Present
                </button>
                <button 
                    onClick={handleSaveAttendance}
                    className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm ${isEditMode ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-[#135bec] hover:bg-blue-600 shadow-blue-200'}`}
                >
                    {isEditMode ? <RefreshCw className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {isEditMode ? 'Update Corrections' : 'Save Attendance'}
                </button>
                </div>
            </div>

            {/* Table List */}
            <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${isEditMode ? 'border-amber-200' : 'border-slate-200'}`}>
                <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[#f6f6f8]">
                    <tr>
                        <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">Student Info</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200 text-center">Batch/Major</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200 text-center">Attendance Status</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">Notes & Evidence</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length > 0 ? (
                        filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-full ${getAvatarColor(student.color)} flex items-center justify-center font-bold text-sm shrink-0`}>
                                {student.initials}
                                </div>
                                <div>
                                <div className="text-sm font-bold text-slate-900">{student.name}</div>
                                <div className="text-xs text-slate-500 font-mono">{student.nim}</div>
                                </div>
                            </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-bold text-slate-700">{student.batch}</span>
                                <span className="text-[10px] text-slate-500">{student.major}</span>
                            </div>
                            </td>
                            <td className="px-6 py-4">
                            <div className="flex justify-center gap-3">
                                <RadioOption studentId={student.id} value="H" label="H" currentStatus={student.status} colorClass="text-emerald-600 border-emerald-200" bgClass="bg-emerald-50" activeBgClass="bg-emerald-500 border-emerald-500" borderClass="border-slate-200" />
                                <RadioOption studentId={student.id} value="I" label="I" currentStatus={student.status} colorClass="text-amber-600 border-amber-200" bgClass="bg-amber-50" activeBgClass="bg-amber-500 border-amber-500" borderClass="border-slate-200" />
                                <RadioOption studentId={student.id} value="S" label="S" currentStatus={student.status} colorClass="text-blue-600 border-blue-200" bgClass="bg-blue-50" activeBgClass="bg-blue-500 border-blue-500" borderClass="border-slate-200" />
                                <RadioOption studentId={student.id} value="A" label="A" currentStatus={student.status} colorClass="text-red-600 border-red-200" bgClass="bg-red-50" activeBgClass="bg-red-500 border-red-500" borderClass="border-slate-200" />
                            </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Add note..." 
                                        value={student.note}
                                        onChange={(e) => handleNoteChange(student.id, e.target.value)}
                                        className="w-full text-sm border-b border-transparent hover:border-slate-200 focus:border-[#135bec] focus:outline-none bg-transparent py-1 transition-colors text-slate-600 placeholder:text-slate-300"
                                    />
                                </div>
                            </td>
                        </tr>
                        ))
                    ) : (
                        <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-slate-500 italic">
                            No students found matching current filters.
                        </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
      )}

      {/* --- HISTORY VIEW --- */}
      {activeTab === 'history' && !isEditMode && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             
             {/* Summary Cards */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Total Entries</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{historyStats.total}</h3>
                        </div>
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Database className="w-4 h-4" /></div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs text-emerald-600 font-medium">Present (H)</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{historyStats.h}</h3>
                        </div>
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><CheckCircle className="w-4 h-4" /></div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs text-amber-600 font-medium">Issues (I/S)</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{historyStats.i + historyStats.s}</h3>
                        </div>
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><AlertCircle className="w-4 h-4" /></div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs text-red-600 font-medium">Absent (A)</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{historyStats.a}</h3>
                        </div>
                        <div className="p-2 bg-red-100 rounded-lg text-red-600"><XCircle className="w-4 h-4" /></div>
                    </div>
                </div>
             </div>

             {/* History Toolbar & View Switcher */}
             <div className="flex flex-col xl:flex-row gap-4 justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                 
                 {/* Left: View Mode & Bulk Delete */}
                 <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    <div className="flex p-1 bg-slate-100 rounded-lg">
                        <button 
                            onClick={() => setHistoryViewMode('issues')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${historyViewMode === 'issues' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Absence Only
                        </button>
                        <button 
                            onClick={() => setHistoryViewMode('all')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${historyViewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Full Log
                        </button>
                    </div>

                    {/* Bulk Delete Button (Only active if date filtered) */}
                    <button 
                        onClick={initiateBulkDelete}
                        disabled={!historyDateFilter}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                            historyDateFilter 
                            ? 'bg-white border-red-200 text-red-600 hover:bg-red-50 cursor-pointer shadow-sm' 
                            : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        title={historyDateFilter ? "Delete all logs for selected date" : "Select a date to enable bulk delete"}
                    >
                        <Eraser className="w-3.5 h-3.5" />
                        Clear Daily Log
                    </button>
                 </div>

                 {/* Right: Search & Filters */}
                 <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                     {/* Date Filter for Deletion/Viewing */}
                     <div className="relative sm:w-36">
                        <input 
                            type="date"
                            value={historyDateFilter}
                            onChange={(e) => setHistoryDateFilter(e.target.value)}
                            className="w-full rounded-lg h-9 border border-slate-200 bg-[#f6f6f8] text-slate-900 text-xs px-2 outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                     </div>

                     <div className="relative flex-1 sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-slate-400" />
                        </div>
                        <input 
                            type="text"
                            placeholder="Search student or NIM..."
                            value={historySearch}
                            onChange={(e) => setHistorySearch(e.target.value)}
                            className="w-full rounded-lg h-9 border border-slate-200 bg-[#f6f6f8] text-slate-900 text-sm pl-9 pr-3 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none"
                        />
                     </div>
                     <div className="relative sm:w-40">
                         <select 
                            value={historyBatchFilter}
                            onChange={(e) => setHistoryBatchFilter(e.target.value)}
                            className="w-full appearance-none rounded-lg h-9 border border-slate-200 bg-[#f6f6f8] text-slate-900 text-sm px-3 pr-8 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none cursor-pointer"
                         >
                             <option value="All">All Batches</option>
                             <option value="15">15</option>
                             <option value="16">16</option>
                             <option value="17">17</option>
                             <option value="18">18</option>
                             <option value="19">19</option>
                         </select>
                         <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                            <Filter className="text-slate-400 w-4 h-4" />
                         </div>
                     </div>
                 </div>
             </div>

             {/* History Table */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#f6f6f8]">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">Student Info</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">Note</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map((log) => (
                                    <tr key={log.id} className={`transition-colors ${log.status === 'H' ? 'hover:bg-slate-50' : 'bg-red-50/10 hover:bg-red-50/30'}`}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm font-medium">{log.date}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-9 w-9 rounded-full ${getAvatarColor(log.avatarColor)} flex items-center justify-center font-bold text-xs shrink-0`}>
                                                    {log.initials}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-900">{log.studentName}</div>
                                                    <div className="text-xs text-slate-500 font-mono">{log.nim} • {log.batch}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(log.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.note ? (
                                                <div className="flex items-start gap-2 max-w-xs">
                                                    <span className="text-sm text-slate-700 italic truncate" title={log.note}>"{log.note}"</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => initiateSingleDelete(log)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                                title="Delete Record"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                                        <div className="p-3 bg-slate-100 rounded-full">
                                            <History className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <span>No records found for this view.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
                    <span>
                        Showing <strong>{historyViewMode === 'issues' ? 'Absence & Issues' : 'All Logs'}</strong>
                    </span>
                    <span>Total {filteredHistory.length} entries displayed</span>
                </div>
             </div>
          </div>
      )}

    </div>
  );
};