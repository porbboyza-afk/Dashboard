export function freshnessNotice(state, readAt, errorMessage = '') {
  if (state==='fresh') return '';
  if (state==='stale' && readAt) {
    const time=new Date(readAt).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    return `กำลังแสดงข้อมูลเก่าที่อ่านสำเร็จเมื่อ ${time}; Firebase ยังตอบไม่ได้ จึงห้ามบันทึกข้อมูลจนกว่าจะโหลดใหม่สำเร็จ`;
  }
  return errorMessage || 'ยังอ่านข้อมูลจาก MyDash ไม่สำเร็จ';
}
