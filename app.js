/* Global Config */
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwj20bpWlrcMXz8D24a31guv2Vj3D0R1_u-09eaIkpcGB2Fr96UhQErfXI5twjGSUAOjQ/exec';

let isAdmin = false;

function showOverlay(show) {
  const el = document.getElementById('pageOverlay');
  if (!el) return;
  el.style.display = show ? 'flex' : 'none';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve({
      base64: reader.result, // includes data:mime;base64,
      name: file.name,
      type: file.type
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(i => i.value);
}

function calcAgeFromDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 0 ? '' : age;
}

function validateForm(form) {
  const fullName = form.fullName.value.trim();
  const officerType = form.officerType.value;
  const caseType = form.caseType.value;
  const p1 = document.getElementById('photo1').files[0];
  const p2 = document.getElementById('photo2').files[0];
  if (!fullName) return 'กรุณากรอกชื่อ-สกุล';
  if (!officerType) return 'กรุณาเลือกประเภทเจ้าหน้าที่ของรัฐ';
  if (!caseType) return 'กรุณาเลือกกรณี';
  if (!p1 || !p2) return 'กรุณาแนบรูปถ่ายให้ครบ 2 รูป';
  if (caseType === 'ขอมีบัตรครั้งแรก' && !document.querySelector('input[name="case1Reason"]:checked')) return 'กรุณาเลือกเหตุผลในกรณีที่ 1';
  if (caseType === 'ขอมีบัตรใหม่' && !document.querySelector('input[name="case2Reason"]:checked')) return 'กรุณาเลือกเหตุผลในกรณีที่ 2';
  if (caseType === 'ขอเปลี่ยนบัตร') {
    const reasons = getCheckedValues('case3Reasons');
    if (reasons.length === 0) return 'กรุณาเลือกเหตุผลในกรณีที่ 3';
    if (reasons.includes('อื่นๆ')) {
      const t = (form.case3OtherText.value || '').trim();
      if (!t) return 'โปรดระบุเหตุผลอื่น ๆ เพิ่มเติม';
    }
  }
  return null;
}

function buildCaseSummary(form) {
  const caseType = form.caseType.value;
  if (caseType === 'ขอมีบัตรครั้งแรก') {
    const r = form.case1Reason.value || '';
    return `${caseType} : ${r}`;
  }
  if (caseType === 'ขอมีบัตรใหม่') {
    const r = form.case2Reason.value || '';
    const oldNo = form.oldCardNumber2.value || '';
    return `${caseType} : ${r}${oldNo ? ` | หมายเลขบัตรเดิม: ${oldNo}` : ''}`;
  }
  if (caseType === 'ขอเปลี่ยนบัตร') {
    const reasons = getCheckedValues('case3Reasons');
    const otherText = (form.case3OtherText.value || '').trim();
    const list = reasons.join(', ');
    const listWithOther = reasons.includes('อื่นๆ') && otherText ? `${list} (${otherText})` : list;
    const oldNo = form.oldCardNumber3.value || '';
    return `${caseType} : ${listWithOther}${oldNo ? ` | หมายเลขบัตรเดิม: ${oldNo}` : ''}`;
  }
  return '';
}

async function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const err = validateForm(form);
  if (err) {
    Swal.fire({ icon: 'warning', text: err });
    return;
  }

  const submitStatus = document.getElementById('submitStatus');
  submitStatus.textContent = 'กำลังบันทึกข้อมูล...';
  showOverlay(true);

  try {
    const photo1 = document.getElementById('photo1').files[0];
    const photo2 = document.getElementById('photo2').files[0];
    const otherDoc = document.getElementById('otherDoc').files[0];

    const [p1b, p2b, odb] = await Promise.all([
      fileToBase64(photo1), fileToBase64(photo2), fileToBase64(otherDoc)
    ]);

    const caseSummary = buildCaseSummary(form);

    const params = new URLSearchParams();
    params.append('action', 'submit');

    // Basic fields
    const fields = {
      requestDate: form.requestDate.value,
      writtenAt: form.writtenAt.value,
      fullName: form.fullName.value,
      nationalId: form.nationalId.value,
      birthDate: form.birthDate.value,
      age: form.age.value,
      nationality: form.nationality.value,
      bloodType: form.bloodType.value,
      address: form.address.value,
      province: form.province.value,
      zipcode: form.zipcode.value,
      phone: form.phone.value,
      email: form.email.value,
      officerType: form.officerType.value,
      position: form.position.value,
      school: form.school.value,
      caseType: form.caseType.value,
      caseSummary
    };
    Object.entries(fields).forEach(([k, v]) => params.append(k, v ?? ''));

    // File fields (base64 string, file name, and mime type)
    if (p1b) {
      params.append('photo1_data', p1b.base64);
      params.append('photo1_name', p1b.name);
      params.append('photo1_type', p1b.type);
    }
    if (p2b) {
      params.append('photo2_data', p2b.base64);
      params.append('photo2_name', p2b.name);
      params.append('photo2_type', p2b.type);
    }
    if (odb && odb.base64) {
      params.append('other_data', odb.base64);
      params.append('other_name', odb.name);
      params.append('other_type', odb.type);
    }

    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params.toString()
    });
    const data = await res.json();

    if (data && data.success) {
      submitStatus.textContent = 'บันทึกสำเร็จ';
      Swal.fire({
        icon: 'success',
        title: 'ส่งคำขอสำเร็จ',
        html: `เลขคำขอ: <b>${data.recordId}</b><br>สถานะ: <span class="badge status-pending">อยู่ระหว่างตรวจสอบ</span>`,
      });
      form.reset();
      refreshTable();
    } else {
      throw new Error(data?.message || 'บันทึกไม่สำเร็จ');
    }
  } catch (error) {
    console.error(error);
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message || 'ไม่สามารถบันทึกได้' });
  } finally {
    showOverlay(false);
    setTimeout(() => document.getElementById('submitStatus').textContent = '', 2000);
  }
}

function bindCaseUI() {
  const form = document.getElementById('requestForm');
  // default today date
  const today = new Date();
  form.requestDate.value = today.toISOString().slice(0,10);
  // age auto-calc
  form.birthDate.addEventListener('change', () => {
    form.age.value = calcAgeFromDate(form.birthDate.value);
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'caseType') {
      const val = e.target.value;
      document.getElementById('case1Box').style.display = val === 'ขอมีบัตรครั้งแรก' ? 'block' : 'none';
      document.getElementById('case2Box').style.display = val === 'ขอมีบัตรใหม่' ? 'block' : 'none';
      document.getElementById('case3Box').style.display = val === 'ขอเปลี่ยนบัตร' ? 'block' : 'none';
    }
    if (e.target.id === 'case3OtherChk') {
      document.getElementById('case3OtherText').style.display = e.target.checked ? 'block' : 'none';
    }
  });
}

function adminLogin() {
  Swal.fire({
    title: 'เข้าสู่ระบบผู้ดูแล',
    html: '<input id="swal-user" class="swal2-input" placeholder="ผู้ใช้">' +
          '<input id="swal-pass" type="password" class="swal2-input" placeholder="รหัสผ่าน">',
    focusConfirm: false,
    preConfirm: () => {
      const u = document.getElementById('swal-user').value;
      const p = document.getElementById('swal-pass').value;
      if (u === 'admin' && p === '1234') {
        isAdmin = true;
        return true;
      }
      Swal.showValidationMessage('ข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
      return false;
    }
  }).then(r => {
    if (r.isConfirmed) {
      Swal.fire({ icon: 'success', title: 'ยินดีต้อนรับผู้ดูแลระบบ' });
      refreshTable();
    }
  });
}

async function fetchList() {
  const url = `${SCRIPT_URL}?action=list`;
  const res = await fetch(url);
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

function renderStatusBadge(status) {
  if (status === 'ตรวจสอบแล้ว') {
    return '<span class="badge status-done">ตรวจสอบแล้ว</span>';
  }
  return '<span class="badge status-pending">อยู่ระหว่างตรวจสอบ</span>';
}

function buildDocsButton(row) {
  const imgs = [row.photo1Url, row.photo2Url].filter(Boolean);
  const other = row.otherUrl;
  return `<button class="view-docs px-2 py-1 bg-gray-100 rounded border" data-imgs='${JSON.stringify(imgs)}' data-other='${other || ''}'>ดูเอกสาร</button>`;
}

async function updateStatus(recordId, status) {
  try {
    showOverlay(true);
    const params = new URLSearchParams();
    params.append('action', 'updateStatus');
    params.append('recordId', recordId);
    params.append('status', status);
    params.append('adminUser', 'admin');
    params.append('adminPass', '1234');
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params.toString()
    });
    const data = await res.json();
    if (data?.success) {
      refreshTable();
    } else {
      throw new Error(data?.message || 'อัปเดตไม่สำเร็จ');
    }
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: e.message });
  } finally {
    showOverlay(false);
  }
}

let dataTableInstance = null;

async function refreshTable() {
  showOverlay(true);
  try {
    const items = await fetchList();

    const columns = [
      { title: 'ลำดับ', data: null, render: (data, type, row, meta) => meta.row + 1 },
      { title: 'ชื่อ-สกุล ผู้ยื่นคำขอ', data: 'fullName' },
      { title: 'เจ้าหน้าที่ของรัฐประเภท', data: 'officerType' },
      { title: 'กรณี', data: 'caseSummary' },
      { title: 'เอกสาร', data: null, render: (d, t, row) => buildDocsButton(row) },
      { title: 'สถานะ', data: 'status', render: (d) => renderStatusBadge(d) }
    ];

    if (isAdmin) {
      columns.push({
        title: 'เปลี่ยนสถานะ', data: null, render: (d, t, row) => {
          const current = row.status === 'ตรวจสอบแล้ว' ? 'ตรวจสอบแล้ว' : 'อยู่ระหว่างตรวจสอบ';
          return `
            <select class="status-select border rounded px-2 py-1" data-id="${row.recordId}">
              <option value="อยู่ระหว่างตรวจสอบ" ${current==='อยู่ระหว่างตรวจสอบ'?'selected':''}>อยู่ระหว่างตรวจสอบ</option>
              <option value="ตรวจสอบแล้ว" ${current==='ตรวจสอบแล้ว'?'selected':''}>ตรวจสอบแล้ว</option>
            </select>
          `;
        }
      });
    }

    if (dataTableInstance) {
      dataTableInstance.clear();
      dataTableInstance.rows.add(items);
      dataTableInstance.draw();
    } else {
      dataTableInstance = new DataTable('#submissionsTable', {
        data: items,
        columns,
        pageLength: 10,
        order: [[0, 'desc']],
        responsive: true,
        language: { url: 'https://cdn.datatables.net/plug-ins/2.0.7/i18n/th.json' }
      });

      $('#submissionsTable').on('click', '.view-docs', function() {
        const imgs = JSON.parse(this.getAttribute('data-imgs') || '[]');
        const other = this.getAttribute('data-other');
        let html = '';
        if (imgs.length) {
          html += imgs.map(u => `<img src="${u}" style="max-width:100%;margin-bottom:8px;border-radius:8px;">`).join('');
        }
        if (other) {
          html += `<p><a href="${other}" target="_blank" class="text-blue-600 underline">เอกสารอื่น ๆ</a></p>`;
        }
        Swal.fire({ title: 'เอกสารที่แนบ', html, width: 700 });
      });

      $('#submissionsTable').on('change', '.status-select', function() {
        const id = this.getAttribute('data-id');
        const val = this.value;
        updateStatus(id, val);
      });
    }
  } catch (e) {
    console.error(e);
    Swal.fire({ icon: 'error', title: 'ไม่สามารถโหลดรายการได้' });
  } finally {
    showOverlay(false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  bindCaseUI();
  document.getElementById('requestForm').addEventListener('submit', submitForm);
  document.getElementById('adminBtn').addEventListener('click', adminLogin);
  refreshTable();
});