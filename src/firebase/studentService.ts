import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { StudentProfile, StudentRecord, SemesterResult, RecordType } from '../types';

/** Remove undefined values so Firestore doesn't reject */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out as T;
}

/** Map record for Firestore (category as string) */
function recordToFirestore(r: StudentRecord): Omit<StudentRecord, 'id'> & { category: string } {
  const { id, ...rest } = r;
  return { ...rest, category: typeof rest.category === 'string' ? rest.category : rest.category };
}

/** Map Firestore record back (category as RecordType) */
function recordFromFirestore(id: string, data: Record<string, unknown>): StudentRecord {
  return {
    id,
    date: (data.date as string) ?? '',
    title: (data.title as string) ?? '',
    category: (data.category as RecordType) ?? RecordType.ACADEMIC,
    description: (data.description as string) ?? '',
    gradeOrResult: (data.gradeOrResult as string) ?? '',
    verifiedBy: (data.verifiedBy as string) ?? '',
  };
}

/** Map history doc from Firestore */
function historyFromFirestore(id: string, data: Record<string, unknown>): SemesterResult {
  return {
    id,
    semesterName: (data.semesterName as string) ?? '',
    gpa: Number(data.gpa) ?? 0,
    credits: Number(data.credits) ?? 0,
    cumulativeGpa: Number(data.cumulativeGpa) ?? 0,
  };
}

/** Get all students from Firestore */
export const getAllStudents = async (): Promise<StudentProfile[]> => {
  const studentsRef = collection(db, 'students');
  const snapshot = await getDocs(studentsRef);

  const students: StudentProfile[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const studentData: StudentProfile = {
      id: docSnap.id,
      name: (data.name as string) ?? '',
      nim: (data.nim as string) ?? '',
      major: (data.major as string) ?? '',
      batch: (data.batch as string) ?? '',
      gpa: Number(data.gpa) ?? 0,
      status: (data.status as StudentProfile['status']) ?? 'Active',
      avatarUrl: (data.avatarUrl as string) ?? '',
      email: (data.email as string) ?? '',
      phone: (data.phone as string) ?? '',
      gender: (data.gender as StudentProfile['gender']) ?? 'Male',
      initials: (data.initials as string) ?? '',
      color: (data.color as StudentProfile['color']) ?? 'blue',
      h: Number(data.h) ?? 0,
      i: Number(data.i) ?? 0,
      s: Number(data.s) ?? 0,
      a: Number(data.a) ?? 0,
      pct: Number(data.pct) ?? 100,
      attendanceStatus: (data.attendanceStatus as StudentProfile['attendanceStatus']) ?? 'Excellent',
      totalCredits: Number(data.totalCredits) ?? 0,
      targetCredits: Number(data.targetCredits) ?? 144,
      achievementCount: Number(data.achievementCount) ?? 0,
      disciplinePoints: Number(data.disciplinePoints) ?? 100,
      tuitionStatus: (data.tuitionStatus as StudentProfile['tuitionStatus']) ?? 'Pending',
      tuitionDate: (data.tuitionDate as string) ?? '',
      economicTier: (data.economicTier as StudentProfile['economicTier']) ?? 3,
      isScholarship: Boolean(data.isScholarship),
      goodStandingNote: (data.goodStandingNote as string) ?? '',
      records: [],
    };
    if (data.tuitionInvoiceUrl != null) studentData.tuitionInvoiceUrl = data.tuitionInvoiceUrl as string;

    const recordsRef = collection(db, 'students', docSnap.id, 'records');
    const recordsSnap = await getDocs(recordsRef);
    studentData.records = recordsSnap.docs.map((r) => recordFromFirestore(r.id, r.data()));

    const historyRef = collection(db, 'students', docSnap.id, 'academicHistory');
    const historySnap = await getDocs(historyRef);
    studentData.academicHistory = historySnap.docs.map((h) => historyFromFirestore(h.id, h.data()));

    students.push(studentData);
  }

  return students;
};

/** Get one student by ID */
export const getStudentById = async (id: string): Promise<StudentProfile | null> => {
  const docRef = doc(db, 'students', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  const studentData: StudentProfile = {
    id: docSnap.id,
    name: (data.name as string) ?? '',
    nim: (data.nim as string) ?? '',
    major: (data.major as string) ?? '',
    batch: (data.batch as string) ?? '',
    gpa: Number(data.gpa) ?? 0,
    status: (data.status as StudentProfile['status']) ?? 'Active',
    avatarUrl: (data.avatarUrl as string) ?? '',
    email: (data.email as string) ?? '',
    phone: (data.phone as string) ?? '',
    gender: (data.gender as StudentProfile['gender']) ?? 'Male',
    initials: (data.initials as string) ?? '',
    color: (data.color as StudentProfile['color']) ?? 'blue',
    h: Number(data.h) ?? 0,
    i: Number(data.i) ?? 0,
    s: Number(data.s) ?? 0,
    a: Number(data.a) ?? 0,
    pct: Number(data.pct) ?? 100,
    attendanceStatus: (data.attendanceStatus as StudentProfile['attendanceStatus']) ?? 'Excellent',
    totalCredits: Number(data.totalCredits) ?? 0,
    targetCredits: Number(data.targetCredits) ?? 144,
    achievementCount: Number(data.achievementCount) ?? 0,
    disciplinePoints: Number(data.disciplinePoints) ?? 100,
    tuitionStatus: (data.tuitionStatus as StudentProfile['tuitionStatus']) ?? 'Pending',
    tuitionDate: (data.tuitionDate as string) ?? '',
    economicTier: (data.economicTier as StudentProfile['economicTier']) ?? 3,
    isScholarship: Boolean(data.isScholarship),
    goodStandingNote: (data.goodStandingNote as string) ?? '',
    records: [],
  };
  if (data.tuitionInvoiceUrl != null) studentData.tuitionInvoiceUrl = data.tuitionInvoiceUrl as string;

  const recordsSnap = await getDocs(collection(db, 'students', id, 'records'));
  studentData.records = recordsSnap.docs.map((r) => recordFromFirestore(r.id, r.data()));

  const historySnap = await getDocs(collection(db, 'students', id, 'academicHistory'));
  studentData.academicHistory = historySnap.docs.map((h) => historyFromFirestore(h.id, h.data()));

  return studentData;
};

/** Add a new student to Firestore */
export const addStudent = async (student: StudentProfile): Promise<string> => {
  const { records, academicHistory, id: inputId, ...rest } = student;
  const studentId = inputId || `ST-${Date.now()}`;
  const studentRef = doc(db, 'students', studentId);

  const rootData = stripUndefined({
    ...rest,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(studentRef, rootData);

  if (records && records.length > 0) {
    const batch = writeBatch(db);
    const recordsRef = collection(db, 'students', studentId, 'records');
    for (const record of records) {
      const ref = doc(recordsRef);
      const recordData = recordToFirestore(record);
      batch.set(ref, recordData);
    }
    await batch.commit();
  }

  if (academicHistory && academicHistory.length > 0) {
    const batch = writeBatch(db);
    const historyRef = collection(db, 'students', studentId, 'academicHistory');
    for (const history of academicHistory) {
      const ref = doc(historyRef);
      const { id: _id, ...histData } = history;
      batch.set(ref, histData);
    }
    await batch.commit();
  }

  return studentId;
};

/** Update an existing student */
export const updateStudent = async (student: StudentProfile): Promise<void> => {
  const { records, academicHistory, id: studentId, ...rest } = student;
  const studentRef = doc(db, 'students', studentId);

  await updateDoc(studentRef, stripUndefined({ ...rest, updatedAt: serverTimestamp() }));

  const recordsRef = collection(db, 'students', studentId, 'records');
  const oldRecords = await getDocs(recordsRef);
  const deleteBatch = writeBatch(db);
  oldRecords.docs.forEach((d) => deleteBatch.delete(d.ref));
  await deleteBatch.commit();

  if (records && records.length > 0) {
    const addBatch = writeBatch(db);
    for (const record of records) {
      const ref = doc(recordsRef);
      const recordData = recordToFirestore(record);
      addBatch.set(ref, recordData);
    }
    await addBatch.commit();
  }

  const historyRef = collection(db, 'students', studentId, 'academicHistory');
  const oldHistory = await getDocs(historyRef);
  const deleteBatch2 = writeBatch(db);
  oldHistory.docs.forEach((d) => deleteBatch2.delete(d.ref));
  await deleteBatch2.commit();

  if (academicHistory && academicHistory.length > 0) {
    const addBatch2 = writeBatch(db);
    for (const history of academicHistory) {
      const ref = doc(historyRef);
      const { id: _id, ...histData } = history;
      addBatch2.set(ref, histData);
    }
    await addBatch2.commit();
  }
};

/** Delete a student and subcollections */
/** Hapus semua attendance logs milik satu student berdasarkan nim */
export const deleteStudentAttendanceLogs = async (nim: string): Promise<void> => {
  const logsRef = collection(db, 'attendanceLogs');
  const snapshot = await getDocs(logsRef);
  
  const batch = writeBatch(db);
  snapshot.docs
    .filter(d => d.data().nim === nim)
    .forEach(d => batch.delete(d.ref));
  
  await batch.commit();
};

export const deleteStudent = async (id: string): Promise<void> => {
  // Ambil NIM student dulu sebelum dihapus
  const studentDoc = await getDoc(doc(db, 'students', id));
  const nim = studentDoc.data()?.nim as string;

  const recordsSnap = await getDocs(collection(db, 'students', id, 'records'));
  const historySnap = await getDocs(collection(db, 'students', id, 'academicHistory'));

  const batch = writeBatch(db);
  recordsSnap.docs.forEach((d) => batch.delete(d.ref));
  historySnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'students', id));

  await batch.commit();

  // Hapus juga semua attendance logs milik student ini
  if (nim) {
    await deleteStudentAttendanceLogs(nim);
  }
};

/** Update attendance fields only on a student document */
export const updateStudentAttendance = async (
  studentId: string,
  attendanceData: { h: number; i: number; s: number; a: number; pct: number; attendanceStatus: string }
): Promise<void> => {
  const studentRef = doc(db, 'students', studentId);
  await updateDoc(studentRef, {
    ...attendanceData,
    updatedAt: serverTimestamp(),
  });
};

/** Seed initial data (run once when Firestore is empty) */
export const seedStudentsToFirestore = async (students: StudentProfile[]): Promise<{ success: number; failed: number }> => {
  let successCount = 0;
  let failedCount = 0;

  for (const student of students) {
    try {
      await addStudent(student);
      successCount++;
    } catch (error) {
      failedCount++;
      console.error(`Gagal seed student ${student.name} (${student.nim}):`, error);
    }
  }

  console.log(`Seed data selesai: ${successCount} berhasil, ${failedCount} gagal`);
  
  if (failedCount > 0) {
    throw new Error(`Seed data gagal: ${failedCount} dari ${students.length} student tidak berhasil ditambahkan`);
  }

  return { success: successCount, failed: failedCount };
};

/**
 * Hitung ulang statistik absensi satu student dari attendanceLogs
 * berdasarkan NIM, lalu update ke dokumen student di Firestore.
 */
export const recalculateStudentAttendance = async (
  nim: string,
  studentId: string
): Promise<void> => {
  const logsSnap = await getDocs(collection(db, 'attendanceLogs'));
  const studentLogs = logsSnap.docs
    .map(d => d.data())
    .filter(d => d.nim === nim);

  let h = 0, i = 0, s = 0, a = 0;
  for (const log of studentLogs) {
    if (log.status === 'H') h++;
    else if (log.status === 'I') i++;
    else if (log.status === 'S') s++;
    else if (log.status === 'A') a++;
  }

  const total = h + i + s + a;
  const pct = total > 0 ? Math.round((h / total) * 1000) / 10 : 100;

  let attendanceStatus: 'Excellent' | 'Good' | 'Warning' | 'Critical';
  if (pct >= 95) attendanceStatus = 'Excellent';
  else if (pct >= 85) attendanceStatus = 'Good';
  else if (pct >= 70) attendanceStatus = 'Warning';
  else attendanceStatus = 'Critical';

  await updateDoc(doc(db, 'students', studentId), {
    h, i, s, a, pct, attendanceStatus,
    updatedAt: serverTimestamp()
  });
};

/**
 * Hitung ulang statistik SEMUA student dari attendanceLogs.
 * Jalankan sekali untuk sinkronisasi data yang tidak akurat.
 */
export const recalculateAllStudentsAttendance = async (): Promise<void> => {
  const studentsSnap = await getDocs(collection(db, 'students'));
  const logsSnap = await getDocs(collection(db, 'attendanceLogs'));
  const allLogs = logsSnap.docs.map(d => d.data());

  for (const studentDoc of studentsSnap.docs) {
    const nim = studentDoc.data().nim as string;
    const studentLogs = allLogs.filter(l => l.nim === nim);

    let h = 0, i = 0, s = 0, a = 0;
    for (const log of studentLogs) {
      if (log.status === 'H') h++;
      else if (log.status === 'I') i++;
      else if (log.status === 'S') s++;
      else if (log.status === 'A') a++;
    }

    const total = h + i + s + a;
    const pct = total > 0 ? Math.round((h / total) * 1000) / 10 : 100;

    let attendanceStatus: 'Excellent' | 'Good' | 'Warning' | 'Critical';
    if (pct >= 95) attendanceStatus = 'Excellent';
    else if (pct >= 85) attendanceStatus = 'Good';
    else if (pct >= 70) attendanceStatus = 'Warning';
    else attendanceStatus = 'Critical';

    await updateDoc(doc(db, 'students', studentDoc.id), {
      h, i, s, a, pct, attendanceStatus,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ ${studentDoc.data().name} (${nim}): H=${h} I=${i} S=${s} A=${a} → ${pct}%`);
  }

  console.log('🎉 Semua statistik student berhasil disinkronkan!');
};
