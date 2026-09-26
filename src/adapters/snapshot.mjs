export async function loadSnapshot() {
  const response = await fetch('/api/snapshot', {cache: 'no-store', credentials: 'same-origin'});
  if (!response.ok) throw new Error('ยังอ่านข้อมูล MyDash ไม่สำเร็จ กรุณาลองอีกครั้ง');
  const snapshot = await response.json();
  if (snapshot.schemaVersion !== 1 || !snapshot.data) throw new Error('รูปแบบข้อมูลไม่รองรับ');
  return snapshot;
}
