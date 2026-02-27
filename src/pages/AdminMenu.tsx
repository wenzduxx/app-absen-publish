import React from 'react';
import { Users, ClipboardCheck, BarChart2, Settings, ArrowRight, ShieldCheck, GraduationCap } from 'lucide-react';
import { recalculateAllStudentsAttendance } from '../firebase/studentService';

interface AdminMenuProps {
  onNavigate: (page: string) => void;
}

export const AdminMenu: React.FC<AdminMenuProps> = ({ onNavigate }) => {
  const menuItems = [
    {
      id: 'Students',
      title: 'Student Management',
      description: 'Add, edit, and manage student profiles and academic records.',
      icon: Users,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      id: 'Attendance',
      title: 'Daily Attendance',
      description: 'Record daily attendance and manage absence evidence.',
      icon: ClipboardCheck,
      color: 'bg-emerald-500',
      lightColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      id: 'Statistik',
      title: 'Attendance Analytics',
      description: 'View detailed reports and trends for student attendance.',
      icon: BarChart2,
      color: 'bg-purple-500',
      lightColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      id: 'Settings',
      title: 'System Settings',
      description: 'Configure academic periods, classes, and system preferences.',
      icon: Settings,
      color: 'bg-slate-500',
      lightColor: 'bg-slate-50',
      textColor: 'text-slate-600',
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-blue-600 mb-1">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Admin Control Center</span>
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Main Menu</h1>
        <p className="text-slate-500 max-w-2xl">
          Welcome to the UniPortal Admin Panel. Select a module below to manage your academic operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="group relative flex flex-col text-left p-8 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 overflow-hidden"
          >
            <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${item.color}`}></div>
            
            <div className="flex items-start justify-between mb-6">
              <div className={`p-4 rounded-2xl ${item.lightColor} ${item.textColor} group-hover:scale-110 transition-transform duration-300`}>
                <item.icon className="w-8 h-8" />
              </div>
              <div className="p-2 rounded-full bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <ArrowRight className="w-5 h-5" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{item.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              {item.description}
            </p>

            <div className="mt-auto flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">
                Open Module
                <div className="h-px flex-1 bg-slate-100 group-hover:bg-blue-100 transition-colors"></div>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
            <GraduationCap className="w-32 h-32" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
                <h4 className="text-lg font-bold">Need help with the system?</h4>
                <p className="text-slate-400 text-sm max-w-md">
                    Check out our documentation or contact the IT support team for assistance with administrative tasks.
                </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
                View Documentation
              </button>
              <button 
                onClick={async () => {
                  try {
                    await recalculateAllStudentsAttendance();
                    alert('✅ Sinkronisasi selesai! Silakan refresh halaman untuk melihat data terbaru.');
                  } catch (e) {
                    alert('❌ Gagal sinkronisasi: ' + e);
                  }
                }}
                className="px-6 py-3 bg-yellow-400 text-yellow-900 rounded-xl font-bold text-sm hover:bg-yellow-300 transition-colors"
              >
                🔄 Sinkronkan Statistik Absensi
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};
