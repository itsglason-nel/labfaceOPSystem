"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Calendar, Clock, Play, Users, Search, Save, Trash2, ChevronDown, AlertCircle, UserPlus, Bell, ArrowRightLeft } from 'lucide-react';
import axios from 'axios';
import { useNavigation } from '@/context/NavigationContext';
import ConfirmModal from './ConfirmModal';

interface SessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    classId: number | null;
    className?: string;
    onSuccess: () => void;
}

interface Student {
    id: number | null;
    enrollment_id: number;
    user_id: string;
    first_name: string;
    last_name: string;
    course: string;
    year_level: number;
    is_registered: number; // 0 or 1
    group_name?: string;
    group_id?: number;
}

export default function SessionModal({ isOpen, onClose, classId, className, onSuccess }: SessionModalProps) {
    const router = useRouter();
    const { setActiveTab } = useNavigation();
    const [type, setType] = useState('regular'); // regular, makeup, batch
    const [loading, setLoading] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [edgeNodeHealth, setEdgeNodeHealth] = useState<boolean>(true);

    // Form State
    const now = new Date();
    const phTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);

    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
    const [customTime, setCustomTime] = useState(phTime);
    const [customEndTime, setCustomEndTime] = useState('09:30');
    const [sessionName, setSessionName] = useState('');
    const [reason, setReason] = useState('');
    const [makeupByBatch, setMakeupByBatch] = useState(false);
    const [lateThreshold, setLateThreshold] = useState(15);



    // Batch session state
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingStudents, setLoadingStudents] = useState(false);

    // Group Management State
    const [groups, setGroups] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'schedule' | 'create_batch' | 'requests'>('schedule');
    const [newGroupName, setNewGroupName] = useState('');
    const [isSavingGroup, setIsSavingGroup] = useState(false);
    const [hideAssigned, setHideAssigned] = useState(false);
    const [isCapacityEnabled, setIsCapacityEnabled] = useState(false);
    const [groupCapacity, setGroupCapacity] = useState<number>(30);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);

    // Status State (For Restrictions)
    const [todayStatus, setTodayStatus] = useState<any>(null);
    const [fetchingStatus, setFetchingStatus] = useState(false);

    // Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'danger' | 'warning' | 'success' | 'info';
        onConfirm?: () => void;
        confirmText?: string;
        isAlert?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    // Scheduling State
    const [scheduledBatches, setScheduledBatches] = useState<any[]>([]);
    const [selectedScheduleGroupId, setSelectedScheduleGroupId] = useState('');

    // Fetch Initial Data
    useEffect(() => {
        if (classId && isOpen) {
            fetchStatusToday();
            if (type === 'batch' || (type === 'makeup' && makeupByBatch)) {
                fetchEnrolledStudents();
                fetchGroups();
                fetchPendingRequests();
            }
        }
    }, [type, makeupByBatch, classId, isOpen]);

    const fetchPendingRequests = async () => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await axios.get(`${API_URL}/api/groups/class/${classId}/requests`);
            setPendingRequests(response.data);
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        }
    };

    const handleRequestAction = async (requestId: number, action: 'approve' | 'reject') => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            await axios.post(`${API_URL}/api/groups/requests/${requestId}/${action}`);
            await fetchPendingRequests();
            await fetchGroups(); // Refresh groups if join was approved
            await fetchEnrolledStudents();
        } catch (error) {
            console.error(`Failed to ${action} request:`, error);
        }
    };

    const fetchStatusToday = async () => {
        setFetchingStatus(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await axios.get(`${API_URL}/api/classes/${classId}/status-today`);
            setTodayStatus(res.data);
        } catch (e) {
            console.error('Failed to fetch status:', e);
        } finally {
            setFetchingStatus(false);
        }
    };

    const fetchGroups = async () => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await axios.get(`${API_URL}/api/groups/class/${classId}`);
            setGroups(response.data);
        } catch (error) {
            console.error('Failed to fetch groups:', error);
        }
    };

    const handleSaveGroup = async () => {
        if (!newGroupName || selectedStudents.length === 0) return;
        setIsSavingGroup(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            await axios.post(`${API_URL}/api/groups`, {
                classId,
                name: newGroupName,
                enrollmentIds: selectedStudents,
                capacity: isCapacityEnabled ? groupCapacity : null
            });
            
            setNewGroupName('');
            setSelectedStudents([]);
            setIsCapacityEnabled(false);
            setGroupCapacity(30);
            await fetchGroups();
            await fetchEnrolledStudents(); // Refresh student availability badges
            setViewMode('schedule');
            setConfirmModal({
                isOpen: true,
                title: 'Success',
                message: 'Group saved successfully!',
                type: 'success',
                confirmText: 'OK',
                isAlert: true
            });
        } catch (error) {
            console.error('Failed to save group:', error);
            setConfirmModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to save group. Please try again.',
                type: 'danger',
                confirmText: 'OK',
                isAlert: true
            });
        } finally {
            setIsSavingGroup(false);
        }
    };

    const handleDeleteGroup = async (groupId: number) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Group',
            message: 'Are you sure you want to delete this group?',
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
                    await axios.delete(`${API_URL}/api/groups/${groupId}`);
                    
                    // Remove from scheduled batches if present
                    setScheduledBatches(prev => prev.filter(b => b.groupId !== groupId));
                    
                    await fetchGroups();
                    await fetchEnrolledStudents(); // Refresh student availability badges
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error('Failed to delete group:', error);
                    setConfirmModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete group.',
                        type: 'danger',
                        confirmText: 'OK',
                        isAlert: true
                    });
                }
            }
        });
    };

    const handleAddToSchedule = () => {
        if (!selectedScheduleGroupId) return;
        const group = groups.find(g => String(g.id) === selectedScheduleGroupId);
        if (!group) return;

        const newBatch = {
            groupId: group.id,
            groupName: group.name,
            startTime: customTime,
            endTime: customEndTime,
            date: customDate,
            enrollmentIds: group.enrollmentIds,
            lateThreshold: lateThreshold || 15
        };

        setScheduledBatches([...scheduledBatches, newBatch]);
        setSelectedScheduleGroupId('');
    };

    const updateBatchField = (index: number, field: string, value: any) => {
        const newBatches = [...scheduledBatches];
        newBatches[index] = { ...newBatches[index], [field]: value };
        setScheduledBatches(newBatches);
    };

    const handleRemoveFromSchedule = (index: number) => {
        const newBatches = [...scheduledBatches];
        newBatches.splice(index, 1);
        setScheduledBatches(newBatches);
    };

    const fetchEnrolledStudents = async () => {
        setLoadingStudents(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await axios.get(`${API_URL}/api/classes/${classId}/students`);
            setStudents(response.data || []);
        } catch (error) {
            console.error('Failed to fetch students:', error);
            setConfirmModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to load students. Please check your connection.',
                type: 'danger',
                confirmText: 'OK',
                isAlert: true
            });
        } finally {
            setLoadingStudents(false);
        }
    };

    const toggleStudent = (enrollmentId: number) => {
        setSelectedStudents(prev =>
            prev.includes(enrollmentId)
                ? prev.filter(id => id !== enrollmentId)
                : [...prev, enrollmentId]
        );
    };

    const selectAll = () => {
        // Smart selection: Only select unassigned students by default if they aren't all already selected
        const unassigned = filteredStudents.filter(s => !s.group_name);
        const unassignedIds = unassigned.map(s => s.enrollment_id);
        
        // If all unassigned are already selected, then select actually ALL
        const allUnassignedSelected = unassignedIds.every(id => selectedStudents.includes(id));
        
        if (allUnassignedSelected || unassignedIds.length === 0) {
            setSelectedStudents(filteredStudents.map(s => s.enrollment_id));
        } else {
            setSelectedStudents(prev => Array.from(new Set([...prev, ...unassignedIds])));
        }
    };

    const deselectAll = () => {
        setSelectedStudents([]);
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch = `${student.first_name} ${student.last_name} ${student.user_id}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        
        if (hideAssigned && student.group_name) return false;
        
        return matchesSearch;
    });


    // Check if the edge node (AI service / backend) is reachable
    useEffect(() => {
        const checkEdgeNodeHealth = async () => {
            if (!navigator.onLine) {
                setEdgeNodeHealth(false);
                return;
            }
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
                // Fast timeout to avoid hanging the UI
                await axios.get(`${API_URL}/api/health`, { timeout: 3000 });
                setEdgeNodeHealth(true);
            } catch (error) {
                console.warn('Edge node health check failed:', error);
                setEdgeNodeHealth(false);
            }
        };

        checkEdgeNodeHealth();
        const interval = setInterval(checkEdgeNodeHealth, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleStartSession = async () => {
        setLoading(true);
        let willRedirect = false;

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
            const now = new Date();

            // Default values
            let date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
            let startTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
            let endTime = null;
            let isScheduled = false;

            if (type === 'makeup') {
                date = customDate;
                startTime = customTime;
                endTime = customEndTime;

                // Check if future date (using Manila time for today comparison)
                const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
                if (customDate > todayStr) {
                    isScheduled = true;
                }
            }

            // --- BATCH SESSION LOGIC (includes make-up batch) ---
            if (type === 'batch' || (type === 'makeup' && makeupByBatch)) {
                if (scheduledBatches.length === 0) {
                    setConfirmModal({
                        isOpen: true,
                        title: 'Selection Required',
                        message: 'Please add at least one batch to the schedule before starting.',
                        type: 'warning',
                        confirmText: 'OK',
                        isAlert: true
                    });
                    setLoading(false);
                    return;
                }

                let lastStartedSessionId = null;
                let anyBatchScheduled = false;

                for (const batch of scheduledBatches) {
                    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
                    const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());

                    const isFutureDate = batch.date > todayStr;
                    // Strict time check: if today, check if batch start time is > current time
                    const isFutureTime = batch.date === todayStr && batch.startTime > nowTime;

                    const batchIsScheduled = isFutureDate || isFutureTime;
                    if (batchIsScheduled) anyBatchScheduled = true;

                    const payload: any = {
                        classId,
                        date: batch.date,
                        startTime: batch.startTime,
                        endTime: batch.endTime,
                        type: type === 'makeup' ? 'makeup' : 'batch',
                        batchStudents: batch.enrollmentIds,
                        sessionName: batch.groupName,

                        isScheduled: batchIsScheduled,
                        lateThreshold: batch.lateThreshold || 15,
                        autoClose: true
                    };

                    if (type === 'makeup' && reason) {
                        payload.reason = reason;
                    }

                    const response = await axios.post(`${API_URL}/api/attendance/sessions`, payload);
                    if (!batchIsScheduled && response.data.sessionId) {
                        lastStartedSessionId = response.data.sessionId;
                    }
                }

                if (anyBatchScheduled) {
                    alert('Upcoming batches scheduled successfully.');
                    onSuccess();
                }

                if (lastStartedSessionId) {
                    willRedirect = true;
                    willRedirect = true;
                    setIsRedirecting(true);
                    setActiveTab('monitor');
                    router.push(`/professor/dashboard?tab=monitor&sessionId=${lastStartedSessionId}`);
                    // Do NOT close modal, kept open for loading state
                } else {
                    onClose();
                }

            } else {
                // --- REGULAR / MAKEUP LOGIC ---
                const payload: any = {
                    classId,
                    date,
                    startTime,
                    type,
                    isScheduled,
                    lateThreshold: lateThreshold || 15,
                    autoClose: true
                };

                if (endTime) payload.endTime = endTime;
                if (type === 'makeup' && reason) payload.reason = reason;

                const response = await axios.post(`${API_URL}/api/attendance/sessions`, payload);

                if (isScheduled) {
                    alert('Make-up class scheduled and students notified.');
                    // For scheduled future sessions, we do NOT redirect.
                    willRedirect = false;
                    onSuccess();
                    onClose();
                } else if (response.data.sessionId) {
                    // Immediate start
                    willRedirect = true;
                    willRedirect = true;
                    setIsRedirecting(true);
                    setActiveTab('monitor');
                    router.push(`/professor/dashboard?tab=monitor&sessionId=${response.data.sessionId}`);
                    // Do NOT close modal, kept open for loading state
                }
            }

            // Reset form only if not redirecting
            if (!willRedirect) {
                setType('regular');
                setSelectedStudents([]);
                setSessionName('');
                setReason('');
                setSearchQuery('');
                setScheduledBatches([]);
            }
        } catch (error: any) {
            console.error('Failed to start session:', error);
            const errorMsg = error.response?.data?.error || 'Failed to start session';
            setConfirmModal({
                isOpen: true,
                title: 'Session Error',
                message: errorMsg,
                type: 'danger',
                confirmText: 'OK',
                isAlert: true
            });
            // If error, we are definitely not redirecting successfully
        } finally {
            if (!willRedirect) {
                setLoading(false);
            }
        }
    };



    // Helper to check if Regular is Allowed
    const isRegularAllowed = () => {
        if (!todayStatus || fetchingStatus) return false; // Strict check: fail if data missing or still fetching
        if (todayStatus.isRecuringToday && !todayStatus.isCancelled) return true;
        if (todayStatus.isMakeupScheduled) return true;

        if (todayStatus.isCancelled) return false;

        return false;
    };

    // Helper to check if Batch Start is Allowed (for Today)
    const isBatchStartAllowed = () => {
        // If any batch is scheduled for TODAY (immediate start), we must check if today is a valid class day.
        // If it is a FUTURE batch, it is always allowed (scheduling).
        if (scheduledBatches.length === 0) return false;

        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
        const hasImmediateBatch = scheduledBatches.some(b => b.date <= todayStr);

        if (hasImmediateBatch) {
            // For immediate batches, apply Regular rules unless it's explicitly valid (e.g. Make-up logic handled elsewhere, but this is 'By Batch' tab)
            // The 'By Batch' tab implies Regular Class logic (just splitted).
            // If user wants off-schedule, they should use Make-up Tab -> By Batch.
            return isRegularAllowed();
        }

        return true; // All batches are future
    };

    // Helper text for button
    const getButtonText = () => {
        if (loading || fetchingStatus || isRedirecting) {
            if (isRedirecting) return 'Starting Class...';
            return 'Checking...';
        }

        if (type === 'makeup' && !makeupByBatch) {
            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
            if (customDate > todayStr) return 'Schedule & Notify';
        }

        return type === 'batch' ? 'Start/Schedule Class' : 'Start Session';
    };

    if (!isOpen || !classId) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-identity-navy/20 backdrop-blur-md animate-fade-in text-identity-navy uppercase tracking-[0.15em]">
            <div className={`identity-glass border border-identity-sky/10 rounded-2xl shadow-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative animate-scale-up ${isRedirecting ? 'opacity-90 pointer-events-none' : ''}`}>
                <button
                    onClick={onClose}
                    disabled={isRedirecting}
                    className="absolute top-6 right-6 p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary/40 hover:text-white transition-colors z-10 disabled:opacity-30 rounded-xl"
                    title="Close Modal"
                >
                    <X size={24} />
                </button>

                <h3 className="text-3xl font-black text-identity-navy mb-2 uppercase tracking-tight italic">Start Session</h3>
                <p className="text-[10px] font-bold text-slate-400 mb-8 uppercase tracking-[0.15em]">
                    Start a new attendance session for <span className="text-identity-sky">{className}</span>
                </p>

                {/* Session Type Tabs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                    <button
                        onClick={() => setType('regular')}
                        disabled={isRedirecting}
                        className={`p-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border transition-all shadow-inner ${type === 'regular'
                            ? 'bg-identity-navy text-white border-identity-navy shadow-identity-navy/10'
                            : 'bg-white/40 border-identity-sky/10 text-slate-400 hover:text-identity-navy hover:bg-white/60'
                            }`}
                    >
                        Regular Class
                    </button>
                    <button
                        onClick={() => setType('makeup')}
                        disabled={isRedirecting}
                        className={`p-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border transition-all shadow-inner ${type === 'makeup'
                            ? 'bg-identity-navy text-white border-identity-navy shadow-identity-navy/10'
                            : 'bg-white/40 border-identity-sky/10 text-slate-400 hover:text-identity-navy hover:bg-white/60'
                            }`}
                    >
                        Make-up Class
                    </button>
                    <button
                        onClick={() => setType('batch')}
                        disabled={isRedirecting}
                        className={`p-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border transition-all shadow-inner ${type === 'batch'
                            ? 'bg-identity-navy text-white border-identity-navy shadow-identity-navy/10'
                            : 'bg-white/40 border-identity-sky/10 text-slate-400 hover:text-identity-navy hover:bg-white/60'
                            }`}
                    >
                        By Batch
                    </button>
                </div>

                {/* Regular Session */}
                {type === 'regular' && (
                    <div className={`p-8 rounded-2xl mb-8 border shadow-inner animate-in fade-in duration-300 ${!isRegularAllowed() ? 'bg-red-500/5 border-red-500/20' : 'bg-white/40 border-identity-sky/10'}`}>
                        <div className="flex gap-4 items-start">
                            <div className={`mt-1 p-2 rounded-lg ${!isRegularAllowed() ? 'bg-red-500/10 text-red-400' : 'bg-identity-sky/10 text-identity-sky'}`}>
                                <Play size={20} />
                            </div>
                            <div className="flex-1">
                                <p className={`text-[10px] font-black uppercase tracking-[0.15em] leading-relaxed ${!isRegularAllowed() ? 'text-red-400' : 'text-identity-navy'}`}>
                                    <strong>Regular Session:</strong> Start a live class session immediately.
                                </p>
                                {!isRegularAllowed() && !fetchingStatus && (
                                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/10 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] text-red-400 flex items-center gap-2 shadow-inner">
                                        <AlertCircle size={14} /> Not scheduled for today.
                                    </div>
                                )}
                                {fetchingStatus && (
                                    <div className="mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-secondary/20 animate-pulse">Checking schedule...</div>
                                )}
                                {todayStatus?.isMakeupScheduled && (
                                    <div className="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] text-emerald-400 flex items-center gap-2 shadow-inner">
                                        <Calendar size={14} /> Make-up Class Scheduled for Today.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8">
                            <label className="block text-[10px] font-black text-slate-500 mb-3 uppercase tracking-[0.15em] ml-1">Late Threshold (Minutes)</label>
                            <div className="relative group">
                                <Clock className="absolute left-4 top-3.5 text-slate-300 group-focus-within:text-identity-sky transition-colors" size={18} />
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={lateThreshold}
                                    onChange={(e) => setLateThreshold(parseInt(e.target.value) || 15)}
                                    className="w-full pl-12 pr-4 py-3 bg-white/60 border border-identity-sky/10 rounded-xl text-sm font-black text-identity-navy uppercase tracking-[0.15em] focus:border-identity-sky/50 focus:outline-none transition-all shadow-inner"
                                />
                            </div>
                            <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase tracking-[0.15em] ml-1 italic">Students arriving after {lateThreshold}m will be marked late.</p>
                        </div>
                    </div>
                )}

                {/* Make-up Session */}
                {type === 'makeup' && (
                    <div className="space-y-6 mb-8 animate-in fade-in duration-300">
                        <div className="bg-brand-gold/10 border border-brand-gold/20 p-5 rounded-2xl shadow-inner">
                            <p className="text-[10px] font-black text-brand-gold uppercase tracking-[0.15em] leading-relaxed">
                                <strong>Make-up Class:</strong> Schedule a session for a different date/time. All students will be notified.
                            </p>
                        </div>

                        {/* Make it by batch toggle */}
                        <div className="flex items-center gap-3 p-4 bg-white/60 border border-identity-sky/10 rounded-2xl shadow-inner group hover:border-identity-sky/20 transition-all">
                            <input
                                type="checkbox"
                                id="makeupByBatch"
                                checked={makeupByBatch}
                                onChange={(e) => {
                                    setMakeupByBatch(e.target.checked);
                                    if (!e.target.checked) {
                                        setScheduledBatches([]);
                                        setSelectedStudents([]);
                                    }
                                }}
                                className="w-5 h-5 bg-white border-identity-sky/20 rounded text-identity-sky focus:ring-identity-sky transition-all"
                            />
                            <label htmlFor="makeupByBatch" className="text-[10px] font-black text-identity-navy hover:text-identity-sky cursor-pointer uppercase tracking-[0.15em]">
                                Split into multiple batches?
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-secondary/40 mb-2 uppercase tracking-[0.15em] ml-1">Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-3.5 text-secondary/20" size={18} />
                                    <input
                                        type="date"
                                        value={customDate}
                                        onChange={(e) => setCustomDate(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm font-black text-brand-gold uppercase tracking-[0.15em] focus:border-brand-gold/50 focus:outline-none shadow-inner"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-secondary/40 mb-2 uppercase tracking-[0.15em] ml-1">Start Time</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-3.5 text-secondary/20" size={18} />
                                    <input
                                        type="time"
                                        value={customTime}
                                        onChange={(e) => setCustomTime(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm font-black text-brand-gold uppercase tracking-[0.15em] focus:border-brand-gold/50 focus:outline-none shadow-inner"
                                    />
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-secondary/40 mb-2 uppercase tracking-[0.15em] ml-1">End Time</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-3.5 text-secondary/20" size={18} />
                                    <input
                                        type="time"
                                        value={customEndTime}
                                        onChange={(e) => setCustomEndTime(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm font-black text-brand-gold uppercase tracking-[0.15em] focus:border-brand-gold/50 focus:outline-none shadow-inner"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.15em] ml-1">Reason (Optional)</label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g., Missed class due to holiday"
                                className="w-full p-4 bg-white/60 border border-identity-sky/10 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] text-identity-navy placeholder-slate-300 resize-none focus:border-identity-sky/50 focus:outline-none shadow-inner"
                                rows={2}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-500 mb-3 uppercase tracking-[0.15em] ml-1">Late Threshold (Minutes)</label>
                            <div className="relative">
                                <Clock className="absolute left-4 top-3.5 text-slate-300" size={18} />
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={lateThreshold}
                                    onChange={(e) => setLateThreshold(parseInt(e.target.value) || 15)}
                                    className="w-full pl-12 pr-4 py-3 bg-white/60 border border-identity-sky/10 rounded-xl text-sm font-black text-identity-navy uppercase tracking-[0.15em] focus:border-identity-sky/50 focus:outline-none shadow-inner"
                                />
                                <p className="text-[10px] text-slate-300 mt-2 font-bold uppercase tracking-[0.15em] ml-1">Students arriving after {lateThreshold}m will be marked Late.</p>
                            </div>
                        </div>

                        {/* Batch Selection UI (shown when makeupByBatch is enabled) */}
                        {makeupByBatch && (
                            <div className="space-y-6 border-t border-white/10 pt-8 mt-8">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-black text-identity-navy uppercase tracking-tight">
                                        {viewMode === 'schedule' ? 'Schedule Batches' : 'Create New Batch'}
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode(viewMode === 'schedule' ? 'create_batch' : 'schedule')}
                                        className="text-[10px] font-black text-identity-sky hover:text-identity-navy uppercase tracking-[0.15em] transition-all"
                                    >
                                        {viewMode === 'schedule' ? '+ Create New Batch' : '← Back to Schedule'}
                                    </button>
                                </div>

                                {viewMode === 'create_batch' ? (
                                    // CREATE BATCH VIEW
                                    <div className="space-y-6 animate-fade-in bg-white/40 p-6 rounded-2xl border border-identity-sky/10 shadow-inner">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.15em] ml-1">Batch Name</label>
                                            <input
                                                type="text"
                                                value={newGroupName}
                                                onChange={(e) => setNewGroupName(e.target.value)}
                                                placeholder="e.g., Batch 1"
                                                className="w-full px-4 py-3 bg-white/60 border border-identity-sky/10 rounded-xl text-sm font-black text-identity-navy uppercase tracking-[0.15em] focus:border-identity-sky/50 focus:outline-none shadow-inner"
                                            />
                                        </div>

                                        {/* Slot Limit Logic (Copied from By Batch) */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 bg-white/40 border border-identity-sky/10 rounded-2xl shadow-inner group hover:border-identity-sky/30 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl ${isCapacityEnabled ? 'bg-identity-sky/10 text-identity-sky' : 'bg-slate-100 text-slate-400'}`}>
                                                        <Users size={18} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[10px] font-black text-identity-navy uppercase tracking-[0.15em] mb-0.5">Enable Slot Limit</h4>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.15em] italic">Restrict number of students for this batch</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCapacityEnabled(!isCapacityEnabled)}
                                                    className={`w-12 h-6 rounded-full transition-all relative flex items-center px-1 ${isCapacityEnabled ? 'bg-identity-sky' : 'bg-slate-200'}`}
                                                >
                                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all ${isCapacityEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            {isCapacityEnabled && (
                                                <div className="p-4 bg-identity-sky/5 border border-identity-sky/10 rounded-2xl animate-in zoom-in-95 duration-300">
                                                    <label className="block text-[10px] font-black text-identity-sky mb-2 uppercase tracking-[0.15em] ml-1">Maximum Capacity</label>
                                                    <input
                                                        type="number"
                                                        value={groupCapacity}
                                                        onChange={(e) => setGroupCapacity(parseInt(e.target.value) || 1)}
                                                        className="w-full px-4 py-3 bg-white/60 border border-identity-sky/20 rounded-xl text-sm font-black text-identity-navy focus:border-identity-sky/50 focus:outline-none shadow-inner"
                                                        placeholder="e.g. 30"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-3 ml-1">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
                                                    <Users size={16} />
                                                    Select Students ({selectedStudents.length}/{students.length})
                                                </label>
                                                <div className="flex items-center gap-4">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setHideAssigned(!hideAssigned)}
                                                        className={`text-[8px] px-2 py-1 rounded border font-black uppercase tracking-[0.15em] transition-all ${hideAssigned ? 'bg-identity-sky/20 border-identity-sky text-identity-sky' : 'bg-white/40 border-identity-sky/10 text-slate-400'}`}
                                                    >
                                                        {hideAssigned ? 'Showing Unassigned' : 'Hide Assigned'}
                                                    </button>
                                                    <div className="flex gap-3">
                                                        <button type="button" onClick={selectAll} className="text-[10px] font-black text-identity-sky uppercase tracking-[0.15em]">All</button>
                                                        <span className="text-slate-200">|</span>
                                                        <button type="button" onClick={deselectAll} className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">None</button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="relative mb-3">
                                                <Search className="absolute left-4 top-3.5 text-slate-300" size={16} />
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Search students..."
                                                    className="w-full pl-12 pr-4 py-3 bg-white/60 border border-identity-sky/10 rounded-xl text-[10px] font-black text-identity-navy uppercase tracking-[0.15em] focus:border-identity-sky/50 focus:outline-none shadow-inner"
                                                />
                                            </div>

                                            <div className="bg-white/60 border border-identity-sky/10 rounded-xl max-h-48 overflow-y-auto shadow-inner">
                                                {loadingStudents ? (
                                                    <div className="p-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] animate-pulse">Loading student list...</div>
                                                ) : filteredStudents.length === 0 ? (
                                                    <div className="p-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.15em]">No students found</div>
                                                ) : (
                                                    filteredStudents.map((student) => (
                                                        <label 
                                                            key={student.enrollment_id} 
                                                            className={`flex items-center gap-4 px-4 py-3 hover:bg-identity-sky/5 cursor-pointer border-b border-identity-sky/5 last:border-0 transition-all ${student.group_name ? 'opacity-40' : ''}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedStudents.includes(student.enrollment_id)}
                                                                onChange={() => toggleStudent(student.enrollment_id)}
                                                                className="w-5 h-5 bg-white border-identity-sky/20 rounded text-identity-sky focus:ring-identity-sky"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <div className="text-[10px] font-black text-identity-navy uppercase tracking-[0.15em] truncate">{student.last_name}, {student.first_name}</div>
                                                                        {!student.is_registered && <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-400 text-[8px] font-black uppercase border border-slate-200">NO ACCOUNT</span>}
                                                                    </div>
                                                                    {student.group_name && (
                                                                        <span className="px-2 py-0.5 rounded-lg bg-identity-sky/10 text-identity-sky text-[8px] font-black uppercase border border-identity-sky/20 shrink-0">
                                                                            {student.group_name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[8px] font-black text-slate-400 font-mono mt-0.5 uppercase tracking-[0.15em]">{student.user_id}</div>
                                                            </div>
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSaveGroup}
                                            disabled={!newGroupName || selectedStudents.length === 0 || isSavingGroup}
                                            className="w-full bg-identity-navy text-white font-black uppercase tracking-[0.15em] py-3 rounded-xl hover:bg-identity-navy/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-identity-navy/10"
                                        >
                                            <Save size={18} /> {isSavingGroup ? 'Saving Batch...' : 'Save Batch'}
                                        </button>
                                    </div>
                                ) : (
                                    // SCHEDULE VIEW - Show saved batches
                                    <div className="space-y-3 animate-fade-in">
                                        {groups.length === 0 ? (
                                            <div className="text-center text-secondary/20 font-black uppercase tracking-[0.15em] py-12 border-2 border-dashed border-white/5 rounded-2xl bg-black/20">
                                                No batches created yet.
                                            </div>
                                        ) : (
                                            groups.map((group) => (
                                                <div key={group.id} className="flex items-center gap-4 p-4 bg-black/40 border border-white/5 rounded-xl hover:border-brand-gold/20 transition-all shadow-inner group">
                                                    <input
                                                        type="checkbox"
                                                        checked={scheduledBatches.some(b => b.groupId === group.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setScheduledBatches([...scheduledBatches, {
                                                                    groupId: group.id,
                                                                    groupName: group.name,
                                                                    enrollmentIds: group.enrollmentIds,
                                                                    date: customDate,
                                                                    startTime: customTime,
                                                                    endTime: customEndTime
                                                                }]);
                                                            } else {
                                                                setScheduledBatches(scheduledBatches.filter(b => b.groupId !== group.id));
                                                            }
                                                        }}
                                                        className="w-5 h-5 bg-black/60 border-white/10 rounded text-brand-gold focus:ring-brand-gold"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-[10px] font-black text-white uppercase tracking-[0.15em]">{group.name}</div>
                                                        <div className="text-[8px] font-black text-secondary/40 uppercase tracking-[0.15em] mt-0.5">{group.student_count} students enrolled</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteGroup(group.id)}
                                                        className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary/20 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                                                        title="Delete Batch"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Batch Session */}
                {type === 'batch' && (
                    <div className="space-y-6 mb-8 animate-in fade-in duration-300">
                        {/* Schedule Warning */}
                        <div className={`p-6 rounded-2xl mb-6 border shadow-inner ${!isRegularAllowed() ? 'bg-red-500/5 border-red-500/20' : 'bg-black/40 border-white/5'}`}>
                            <div className="flex gap-4 items-start">
                                <div className={`mt-1 p-2 rounded-lg ${!isRegularAllowed() ? 'bg-red-500/10 text-red-400' : 'bg-brand-gold/10 text-brand-gold'}`}>
                                    <Users size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-[10px] font-black uppercase tracking-[0.15em] leading-relaxed ${!isRegularAllowed() ? 'text-red-400' : 'text-white'}`}>
                                        <strong>Batch Session:</strong> Schedule groups for specific times.
                                    </p>
                                    {!isRegularAllowed() && !fetchingStatus && (
                                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/10 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] text-red-400 flex items-center gap-2 shadow-inner">
                                            <AlertCircle size={14} /> Not scheduled for today.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* View Switcher (Tabs) */}
                        <div className="flex items-center gap-2 mb-8 bg-black/20 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                            {[
                                { id: 'schedule', label: 'Schedule', icon: Clock },
                                { id: 'create_batch', label: 'Create Batch', icon: UserPlus },
                                { id: 'requests', label: 'Requests', icon: Bell, badge: pendingRequests.length }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewMode(tab.id as any)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all relative ${
                                        viewMode === tab.id 
                                        ? 'bg-identity-navy text-white shadow-lg border border-identity-sky/20' 
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <tab.icon size={14} />
                                    {tab.label}
                                    {tab.badge ? (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full shadow-lg border-2 border-identity-navy animate-pulse">
                                            {tab.badge}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </div>

                        {viewMode === 'create_batch' ? (
                            // --- CREATE BATCH VIEW ---
                            <div className="space-y-6 animate-fade-in bg-black/20 p-6 rounded-2xl border border-white/5 shadow-inner">
                                <div>
                                    <label className="block text-[10px] font-black text-secondary/40 mb-2 uppercase tracking-[0.15em] ml-1">Batch Name</label>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        placeholder="e.g., Batch 1"
                                        className="w-full px-4 py-3 bg-black/40 border border-white/5 rounded-xl text-sm font-black text-brand-gold uppercase tracking-[0.15em] focus:border-brand-gold/50 focus:outline-none shadow-inner"
                                    />
                                </div>

                                <div className="bg-white/10 p-4 rounded-xl border border-white/5 shadow-inner">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em]">Enable Slot Limit</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsCapacityEnabled(!isCapacityEnabled)}
                                            className={`w-10 h-5 rounded-full transition-all relative ${isCapacityEnabled ? 'bg-identity-sky' : 'bg-white/10'}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isCapacityEnabled ? 'left-6' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    {isCapacityEnabled && (
                                        <div className="mt-4 animate-in fade-in slide-in-from-top-1">
                                            <label className="block text-[8px] font-black text-slate-400 mb-1 uppercase tracking-[0.15em] ml-1">Max Students</label>
                                            <input
                                                type="number"
                                                value={groupCapacity}
                                                onChange={(e) => setGroupCapacity(parseInt(e.target.value) || 0)}
                                                className="w-full px-4 py-2 bg-black/40 border border-white/5 rounded-lg text-xs font-black text-brand-gold focus:outline-none focus:border-brand-gold/50"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-3 ml-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] flex items-center gap-2">
                                            <Users size={16} />
                                            Select Students ({selectedStudents.length}/{students.length})
                                        </label>
                                        <div className="flex gap-4">
                                            <button type="button" onClick={selectAll} className="text-[10px] font-black text-identity-sky uppercase tracking-[0.15em]">All</button>
                                            <span className="text-slate-200">|</span>
                                            <button type="button" onClick={deselectAll} className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">None</button>
                                        </div>
                                    </div>

                                    <div className="relative mb-3">
                                        <Search className="absolute left-4 top-3.5 text-slate-300" size={16} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search students..."
                                            className="w-full pl-12 pr-4 py-3 bg-white/60 border border-identity-sky/10 rounded-xl text-[10px] font-black text-identity-navy uppercase tracking-[0.15em] focus:border-identity-sky/50 focus:outline-none shadow-inner"
                                        />
                                    </div>

                                    <div className="bg-white/60 border border-identity-sky/10 rounded-xl max-h-48 overflow-y-auto shadow-inner">
                                        {loadingStudents ? (
                                            <div className="p-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] animate-pulse">Loading student list...</div>
                                        ) : filteredStudents.length === 0 ? (
                                            <div className="p-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.15em]">No students found</div>
                                        ) : (
                                            filteredStudents.map((student) => (
                                                <label key={student.enrollment_id} className="flex items-center gap-4 px-4 py-3 hover:bg-identity-sky/5 cursor-pointer border-b border-identity-sky/5 last:border-0 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedStudents.includes(student.enrollment_id)}
                                                        onChange={() => toggleStudent(student.enrollment_id)}
                                                        className="w-5 h-5 bg-white border-identity-sky/20 rounded text-identity-sky focus:ring-identity-sky transition-all"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-[10px] font-black text-identity-navy uppercase tracking-[0.15em] truncate">{student.last_name}, {student.first_name}</div>
                                                            {!student.is_registered && <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-400 text-[8px] font-black uppercase border border-slate-200">NO ACCOUNT</span>}
                                                        </div>
                                                        <div className="text-[8px] font-black text-slate-400 font-mono mt-0.5 uppercase tracking-[0.15em]">{student.user_id}</div>
                                                    </div>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveGroup}
                                    disabled={!newGroupName || selectedStudents.length === 0 || isSavingGroup}
                                    className="w-full bg-identity-navy text-white font-black uppercase tracking-[0.15em] py-3 rounded-xl hover:bg-identity-navy/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-identity-navy/10"
                                >
                                    <Save size={18} /> {isSavingGroup ? 'Saving Batch...' : 'Save Batch'}
                                </button>
                            </div>
                        ) : viewMode === 'requests' ? (
                            // --- REQUESTS VIEW ---
                            <div className="space-y-4 animate-fade-in">
                                {pendingRequests.length === 0 ? (
                                    <div className="text-slate-300 text-[10px] font-black uppercase tracking-[0.15em] py-16 text-center border-2 border-dashed border-identity-sky/5 rounded-2xl bg-white/40 shadow-inner">
                                        No pending requests for this class.
                                    </div>
                                ) : (
                                    pendingRequests.map((req) => (
                                        <div key={req.id} className="bg-white/60 p-5 rounded-2xl border border-identity-sky/10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 group hover:border-identity-sky/30 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${req.request_type === 'swap' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                    {req.request_type === 'swap' ? <ArrowRightLeft size={20} /> : <UserPlus size={20} />}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-identity-navy uppercase tracking-[0.1em]">{req.requester_name}</div>
                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">
                                                        {req.request_type.toUpperCase()} TO: <span className="text-identity-sky">{req.target_group_name}</span>
                                                    </div>
                                                    {req.request_type === 'swap' && (
                                                        <div className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em] mt-1">
                                                            WITH: {req.target_student_name || req.target_student_id} ({req.status === 'pending_peer' ? 'WAITING FOR PEER' : 'PEER AGREED'})
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                <button
                                                    onClick={() => handleRequestAction(req.id, 'reject')}
                                                    className="flex-1 sm:flex-none px-4 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl text-[8px] font-black uppercase tracking-[0.2em] border border-rose-500/10 transition-all"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleRequestAction(req.id, 'approve')}
                                                    disabled={req.request_type === 'swap' && req.status === 'pending_peer'}
                                                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white disabled:opacity-30 disabled:hover:bg-emerald-500/10 disabled:hover:text-emerald-500 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] border border-emerald-500/10 transition-all"
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            // --- SCHEDULE VIEW ---
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white/40 p-6 rounded-2xl border border-identity-sky/10 shadow-inner">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.15em] ml-1">Select Batch</label>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <select
                                                        value={selectedScheduleGroupId}
                                                        onChange={(e) => setSelectedScheduleGroupId(e.target.value)}
                                                        className="w-full px-4 py-3 bg-white/60 border border-identity-sky/10 rounded-xl text-[10px] font-black text-identity-navy uppercase tracking-[0.15em] appearance-none focus:outline-none focus:border-identity-sky/50 shadow-inner"
                                                    >
                                                        <option value="">Select a batch...</option>
                                                        {groups.map(g => (
                                                            <option key={g.id} value={g.id} className="bg-white text-identity-navy">
                                                                {g.name} ({g.enrollmentIds.length}{g.capacity ? ` / ${g.capacity}` : ''} students)
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-4 top-3.5 text-slate-300 pointer-events-none" size={16} />
                                                </div>
                                                {selectedScheduleGroupId && (
                                                    <button
                                                        onClick={() => handleDeleteGroup(Number(selectedScheduleGroupId))}
                                                        className="p-3 bg-white/60 text-red-500 hover:text-red-400 border border-identity-sky/10 hover:border-red-500/20 rounded-xl transition-all shadow-inner" title="Delete Batch"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.15em] ml-1">Start Time</label>
                                            <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="w-full px-4 py-3 bg-white/60 border border-identity-sky/10 rounded-xl text-sm font-black text-identity-navy uppercase tracking-[0.15em] focus:outline-none shadow-inner" style={{ colorScheme: 'light' }} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.15em] ml-1">End Time</label>
                                            <input type="time" value={customEndTime} onChange={(e) => setCustomEndTime(e.target.value)} className="w-full px-4 py-3 bg-white/60 border border-identity-sky/10 rounded-xl text-sm font-black text-identity-navy uppercase tracking-[0.15em] focus:outline-none shadow-inner" style={{ colorScheme: 'light' }} />
                                        </div>
                                    </div>
                                    <div className="mb-6">
                                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.15em] ml-1">Late Threshold (Minutes)</label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-3.5 text-slate-300" size={18} />
                                            <input
                                                type="number"
                                                min="1"
                                                max="60"
                                                value={lateThreshold}
                                                onChange={(e) => setLateThreshold(parseInt(e.target.value) || 15)}
                                                className="w-full pl-12 pr-4 py-3 bg-white/60 border border-identity-sky/10 rounded-xl text-sm font-black text-identity-navy uppercase tracking-[0.15em] focus:outline-none shadow-inner"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleAddToSchedule}
                                        disabled={!selectedScheduleGroupId}
                                        className="w-full bg-white/40 hover:bg-white/60 text-identity-sky border border-identity-sky/10 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all shadow-inner flex items-center justify-center gap-2"
                                    >
                                        + Add Batch to Schedule
                                    </button>
                                </div>

                                {/* Scheduled List */}
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Scheduled Batches</label>
                                    {scheduledBatches.length === 0 ? (
                                        <div className="text-slate-300 text-[10px] font-black uppercase tracking-[0.15em] py-12 text-center border-2 border-dashed border-identity-sky/5 rounded-2xl bg-white/40 shadow-inner">
                                            No batches scheduled.
                                        </div>
                                    ) : (
                                        scheduledBatches.map((batch, idx) => (
                                            <div key={idx} className="flex flex-col bg-white/60 p-5 rounded-2xl border border-identity-sky/10 shadow-inner animate-slide-in group hover:border-identity-sky/20 transition-all">
                                                <div className="flex items-center justify-between mb-4 pb-4 border-b border-identity-sky/5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-identity-sky/10 rounded flex items-center justify-center">
                                                            <Users size={16} className="text-identity-sky" />
                                                        </div>
                                                        <div className="text-[10px] font-black text-identity-navy uppercase tracking-[0.15em]">{batch.groupName}</div>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDeleteGroup(batch.groupId)} 
                                                        className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all" 
                                                        title="Permanently Delete Batch"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                                
                                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="block text-[8px] font-black text-slate-400 mb-2 uppercase tracking-[0.15em] ml-1">Start Time</label>
                                                        <input 
                                                            type="time" 
                                                            value={batch.startTime} 
                                                            onChange={(e) => updateBatchField(idx, 'startTime', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white/60 border border-identity-sky/10 rounded-lg text-xs font-black text-identity-navy uppercase tracking-[0.15em] focus:outline-none focus:border-identity-sky/30 shadow-inner" 
                                                            style={{ colorScheme: 'light' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[8px] font-black text-slate-400 mb-2 uppercase tracking-[0.15em] ml-1">End Time</label>
                                                        <input 
                                                            type="time" 
                                                            value={batch.endTime} 
                                                            onChange={(e) => updateBatchField(idx, 'endTime', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white/60 border border-identity-sky/10 rounded-lg text-xs font-black text-identity-navy uppercase tracking-[0.15em] focus:outline-none focus:border-identity-sky/30 shadow-inner" 
                                                            style={{ colorScheme: 'light' }}
                                                        />
                                                    </div>
                                                    <div className="col-span-2 lg:col-span-1">
                                                        <label className="block text-[8px] font-black text-slate-400 mb-2 uppercase tracking-[0.15em] ml-1 text-nowrap">Late Threshold (Min)</label>
                                                        <input 
                                                            type="number" 
                                                            min="1"
                                                            value={batch.lateThreshold} 
                                                            onChange={(e) => updateBatchField(idx, 'lateThreshold', parseInt(e.target.value) || 15)}
                                                            className="w-full px-3 py-2 bg-white/60 border border-identity-sky/10 rounded-lg text-xs font-black text-identity-navy uppercase tracking-[0.15em] focus:outline-none focus:border-identity-sky/30 shadow-inner" 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* Offline Warning */}
                {!edgeNodeHealth && (
                    <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center animate-pulse">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                            ⚠️ Live Session Unavailable
                        </p>
                        <p className="text-xs text-rose-400 mt-1">
                            The classroom CCTV edge node is currently offline. You cannot start a live session at this time.
                        </p>
                    </div>
                )}

                {/* Start Button */}
                <button
                    onClick={handleStartSession}
                    disabled={
                        loading ||
                        fetchingStatus ||
                        isRedirecting ||
                        !edgeNodeHealth ||
                        (type === 'batch' && (scheduledBatches.length === 0 || !isBatchStartAllowed())) ||
                        (type === 'regular' && !isRegularAllowed())
                    }
                        (type === 'regular' && !isRegularAllowed())
                    }
                    className="w-full bg-identity-navy text-white font-black uppercase tracking-[0.15em] py-5 rounded-xl transition-all shadow-lg shadow-identity-navy/20 flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed group relative overflow-hidden active:scale-95"
                >
                    {loading || isRedirecting ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white"></div>
                    ) : (
                        <>
                            {getButtonText() === 'Schedule & Notify' ? <Calendar size={20} className="group-hover:scale-110 transition-transform" /> : <Play size={20} className="group-hover:scale-110 transition-transform" />}
                            <span className="text-sm">{getButtonText()}</span>
                        </>
                    )}
                </button>
            </div>
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                isAlert={confirmModal.isAlert}
            />
        </div >
    );
}
