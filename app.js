// === KONFIGURASI ===
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxMZd4ZZ30p_hLIYoon0BMNq_V_Mw7FrfsB-hZgJcqG5yAzIUriYv89PsMX2huV0-8/exec";

// State Aplikasi
let globalData = {
    jenisSurat: [],
    suratMasuk: [],
    suratKeluar: [],
    suratKeputusan: [],
    perjadin: [], // <--- TAMBAHAN BARU
    npd: [], // <--- TAMBAHAN BARU
    kodeKlasifikasi: [] // <--- TAMBAHKAN INI
};

let globalASN = []; // <--- TEMPAT DATABSE ASN

let userList = [];
let currentUser = null;
let targetInputKlasifikasi = "";

// State Pagination
let currentPageMasuk = 1;
let rowsPerPageMasuk = 5;
let currentPageKeluar = 1;
let rowsPerPageKeluar = 5;
let currentPageKeputusan = 1; 
let rowsPerPageKeputusan = 5;
let currentPagePerjadin = 1; 
let rowsPerPagePerjadin = 5; // <--- TAMBAHAN BARU
let currentPageNpd = 1;      // <--- TAMBAHAN BARU
let rowsPerPageNpd = 5;      // <--- TAMBAHAN BARU

// --- FUNGSI HELPER (Boleh diletakkan di sini) ---
function updatePreviewNomor() {
    // Cek apakah elemen ada untuk menghindari error jika modal belum siap
    const elKode = document.getElementById('inpKode');
    if(!elKode) return; 

    const k = elKode.value;
    const n = document.getElementById('inpNoUrut').value;
    const kl = document.getElementById('inpKodeLanjutan').value;
    const t = document.getElementById('inpTahun').value;
    
    // Logic penggabungan: Kode/NoUrut/KodeLanjutan/Tahun
    document.getElementById('previewNoSurat').innerText = `${k}/${n}/${kl}/${t}`;
}

// --- LOGIKA PENOMORAN PERJADIN ---

function updatePreviewPerjadin() {
    // Preview TS
    const tsK = document.getElementById('tsKode').value;
    const tsN = document.getElementById('tsNo').value;
    const tsS = document.getElementById('tsSuffix').value;
    const tsT = document.getElementById('tsTahun').value;
    document.getElementById('previewTS').innerText = `${tsK}/${tsN}/${tsS}/${tsT}`;

    // Preview SPT
    const sptK = document.getElementById('sptKode').value;
    const sptN = document.getElementById('sptNo').value;
    const sptS = document.getElementById('sptSuffix').value;
    const sptT = document.getElementById('sptTahun').value;
    document.getElementById('previewSPT').innerText = `${sptK}/${sptN}/${sptS}/${sptT}`;
}

function checkDuplicatePerjadin(type) {
    // type bisa 'TS' atau 'SPT'
    const isEdit = document.getElementById('pIsEdit').value === "true";
    if (isEdit) return; // Skip jika sedang edit

    const inputNo = document.getElementById(type === 'TS' ? 'tsNo' : 'sptNo').value;
    const inputTahun = document.getElementById(type === 'TS' ? 'tsTahun' : 'sptTahun').value;
    
    if (!inputNo) return;

    // Loop Data Global Perjadin
    // TS ada di Index 8, SPT ada di Index 9
    const colIndex = type === 'TS' ? 8 : 9;
    const label = type === 'TS' ? 'Telaahan Staf (TS)' : 'Surat Perintah Tugas (SPT)';

    const isDuplicate = globalData.perjadin.some(row => {
        const rawVal = row.values[colIndex] || ""; 
        // Format di DB: Kode/No/Suffix/Tahun
        // Kita cek apakah string tersebut mengandung "/No/" dan "/Tahun"
        // Cara paling aman: Split dulu
        const parts = rawVal.split('/');
        if (parts.length >= 4) {
            const dbNo = parts[1];    // Bagian ke-2 adalah Nomor
            const dbTahun = parts[3]; // Bagian ke-4 adalah Tahun
            return (dbNo === inputNo && dbTahun === inputTahun);
        }
        return false;
    });

    if (isDuplicate) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: `Duplikasi Nomor ${type}!`,
            text: `Nomor Urut ${inputNo} (${inputTahun}) sudah digunakan.`,
            timer: 5000
        });
        // Optional: Beri warna merah pada input
        document.getElementById(type === 'TS' ? 'tsNo' : 'sptNo').classList.add('is-invalid');
    } else {
        document.getElementById(type === 'TS' ? 'tsNo' : 'sptNo').classList.remove('is-invalid');
    }
}

// --- MAIN LISTENER ---
// Force hide loading & Setup Listener saat halaman selesai dimuat
window.addEventListener('load', function() {
    showLoading(false);
    setupDragAndDrop();
    setupDragAndDropPerjadin(); // <--- TAMBAHKAN BARIS INI (Drag Drop Perjadin)
    setupDragAndDropNpd(); // <--- TAMBAHKAN INI

    // PINDAHKAN LISTENER KE SINI (LEBIH AMAN)
    // Listener untuk auto-preview Nomor Surat Keluar
    const ids = ['inpKode', 'inpNoUrut', 'inpKodeLanjutan', 'inpTahun'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', updatePreviewNomor);
        }
    });
    
    // LISTENER PREVIEW PERJADIN (TS & SPT)
    const idsPerjadin = ['tsKode', 'tsNo', 'tsSuffix', 'tsTahun', 'sptKode', 'sptNo', 'sptSuffix', 'sptTahun'];
    idsPerjadin.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', updatePreviewPerjadin);
        }
    });	

    // --- TAMBAHKAN INI UNTUK PREVIEW NPD ---
    const idsNpd = ['nNoUrut', 'nTahun'];
    idsNpd.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updatePreviewNpd);
    });			
});

// === FUNGSI UTAMA ===

document.getElementById('formLogin').addEventListener('submit', function(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    showLoading(true);
    
    fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'login', username: u, password: p })
    })
    .then(res => res.json())
    .then(data => {
        showLoading(false);
        if (data.status === 'success') {
            currentUser = data.user;
            initApp();
            Swal.fire({
                icon: 'success',
                title: 'Berhasil Login',
                text: `Selamat datang, ${currentUser.nama}`,
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Login Gagal',
                text: data.message
            });
        }
    })
    .catch(err => {
        showLoading(false);
        Swal.fire({ icon: 'error', title: 'Error', text: "Koneksi Error: " + err });
    });
});

function initApp() {
    document.getElementById('loginPanel').classList.add('d-none');
    document.getElementById('appPanel').classList.remove('d-none');
    
    document.getElementById('userNama').innerText = currentUser.nama;
    document.getElementById('userRole').innerText = currentUser.role;
    
    if (currentUser.role !== 'Super Admin') {
        document.getElementById('menuPengaturan').classList.add('d-none');
    } else {
        loadUsers();
        renderJenisSuratSettings();
    }
    loadData();
    
    // --- TAMBAHAN BARU: LOAD DATABASE ASN ---
    fetch(GAS_API_URL + "?action=getAsnData")
        .then(res => res.json())
        .then(resp => {
            if(resp.status === 'success') {
                globalASN = resp.data;
                console.log("Database ASN dimuat:", globalASN.length, "data");
            }
        });			
}

function loadData(isBackground = false) {
    if (!isBackground) showLoading(true);
    
    fetch(GAS_API_URL + "?action=getData")
    .then(res => res.json())
    .then(resp => {
        if (!isBackground) showLoading(false);
        if (resp.status === 'success') {
            
            // === 1. LOGIKA SORTING DI SISI CLIENT ===
            let sortedMasuk = resp.data.suratMasuk.sort((a, b) => {
                return new Date(b.values[2]) - new Date(a.values[2]);
            });

            let sortedKeluar = resp.data.suratKeluar.sort((a, b) => {
                const numA = parseInt(a.values[4]) || 0;
                const numB = parseInt(b.values[4]) || 0;
                return numB - numA;
            });

            // Tambahkan ini untuk menyortir Surat Keputusan (Index 4 adalah No Urut)
            let sortedKeputusan = (resp.data.suratKeputusan || []).sort((a, b) => {
                const numA = parseInt(a.values[4]) || 0;
                const numB = parseInt(b.values[4]) || 0;
                return numB - numA;
            });

            let sortedPerjadin = resp.data.perjadin.sort((a, b) => {
                 return new Date(b.values[1]) - new Date(a.values[1]);
            });
         
            // === 2. SIMPAN KE GLOBAL DATA ===
            if (isBackground) {
                globalData.suratMasuk = sortedMasuk;
                globalData.suratKeluar = sortedKeluar;
                globalData.suratKeputusan = sortedKeputusan; // <--- TAMBAHAN BARU
                globalData.perjadin = sortedPerjadin; 
                globalData.npd = resp.data.npd || []; 
            } else {
                globalData.suratMasuk = sortedMasuk;
                globalData.suratKeluar = sortedKeluar;
                globalData.suratKeputusan = sortedKeputusan; // <--- TAMBAHAN BARU
                globalData.perjadin = sortedPerjadin; 
                globalData.npd = resp.data.npd || []; 
                globalData.jenisSurat = resp.data.jenisSurat;
                globalData.kodeKlasifikasi = resp.data.kodeKlasifikasi || [];
            }

            // === 3. RENDER UI ===
            renderDashboard();
            renderTables();
            
            if (!isBackground) {
                populateDropdown();
                if(currentUser && currentUser.role === 'Super Admin') {
                    renderJenisSuratSettings();
                }
            }
        }
    })
    .catch(err => {
        console.error("Detail Error:", err); // Tambahan agar jika ada error langsung terlihat di F12
        if (!isBackground) {
            showLoading(false);
            Swal.fire({ icon: 'error', title: 'Error', text: "Gagal mengambil data." });
        }
    });
}

function loadUsers() {
    fetch(GAS_API_URL + "?action=getUsers")
    .then(res => res.json())
    .then(resp => {
        if (resp.status === 'success') {
            userList = resp.data;
            renderUserTable();
        }
    });
}

// === KONFIGURASI TOAST (NOTIFIKASI OTOMATIS) ===
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

// === FUNGSI UTAMA: RENDER LIST ===
function renderJenisSuratSettings() {
    const listEl = document.getElementById('listJenisSurat');
    listEl.innerHTML = '';
    
    if (globalData.jenisSurat.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fas fa-inbox fa-3x mb-3 opacity-25"></i>
                <p class="small m-0">Belum ada jenis surat.<br>Klik tombol <b>+ Tambah</b> di atas.</p>
            </div>`;
        return;
    }

    globalData.jenisSurat.forEach((jenis) => {
        const li = document.createElement('li');
        // UPDATE: Font size diperkecil (fs-6 atau style manual)
        li.className = 'list-group-item border-0 shadow-sm mb-2 rounded-3 d-flex justify-content-between align-items-center bg-white';
        li.style.fontSize = "0.9rem"; // <-- UKURAN HURUF DIPERKECIL
        
        li.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <div class="text-muted cursor-move px-2" style="cursor: grab;">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="fw-bold text-dark">${jenis}</div>
            </div>
            <div class="d-flex gap-1">
                <button class="btn btn-sm btn-light text-primary border" onclick="editJenisSurat('${jenis}')">
                    <i class="fas fa-pen fa-xs"></i>
                </button>
                <button class="btn btn-sm btn-light text-danger border" onclick="deleteJenisSurat('${jenis}')">
                    <i class="fas fa-trash-alt fa-xs"></i>
                </button>
            </div>
        `;
        li.dataset.value = jenis;
        listEl.appendChild(li);
    });

    // === INTEGRASI SORTABLE JS DENGAN AUTO SAVE ===
    new Sortable(listEl, {
        animation: 150,
        handle: '.cursor-move',
        ghostClass: 'bg-light',
        onEnd: function (evt) {
            // Saat drag selesai, update urutan data lokal dan simpan ke server
            syncLocalDataFromDOM(); 
            pushAutoSave('Urutan diperbarui');
        }
    });
}

// === FUNGSI BANTUAN: SINKRONISASI DOM KE DATA ===
function syncLocalDataFromDOM() {
    const listEl = document.getElementById('listJenisSurat');
    const items = listEl.querySelectorAll('li');
    const newList = [];
    items.forEach(item => newList.push(item.dataset.value));
    globalData.jenisSurat = newList;
}

// === FUNGSI AUTO SAVE KE SERVER (BACKGROUND) ===
function pushAutoSave(message) {
    // Tampilkan indikator "Menyimpan..." kecil (opsional, tapi Toast sudah cukup)
    
    fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify({
            action: 'manageJenisSurat',
            list: globalData.jenisSurat
        })
    })
    .then(res => res.json())
    .then(resp => {
        if (resp.status === 'success') {
            Toast.fire({ icon: 'success', title: message });
            // Update dropdown di form input surat agar sinkron
            populateDropdown(); 
        }
    })
    .catch(err => {
        Toast.fire({ icon: 'error', title: 'Gagal menyimpan perubahan koneksi' });
    });
}

// === CRUD OPERATION (DENGAN AUTO SAVE) ===

function addJenisSurat() {
    Swal.fire({
        title: 'Tambah Jenis Surat',
        input: 'text',
        inputPlaceholder: 'Cth: Surat Undangan',
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        reverseButtons: true    
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const newValue = result.value.trim();
            if(newValue && !globalData.jenisSurat.includes(newValue)) {
                globalData.jenisSurat.push(newValue);
                renderJenisSuratSettings();
                pushAutoSave('Jenis surat ditambahkan'); // Auto Save
            } else {
                Swal.fire('Info', 'Jenis surat kosong atau sudah ada.', 'info');
            }
        }
    });
}

function editJenisSurat(oldVal) {
    Swal.fire({
        title: 'Ubah Nama',
        input: 'text',
        inputValue: oldVal,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        reverseButtons: true,
        inputValidator: (value) => {
            if (!value) return 'Tidak boleh kosong!';
            if (value !== oldVal && globalData.jenisSurat.includes(value)) return 'Sudah ada!';
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const index = globalData.jenisSurat.indexOf(oldVal);
            if (index !== -1) {
                globalData.jenisSurat[index] = result.value.trim();
                renderJenisSuratSettings();
                pushAutoSave('Nama diperbarui'); // Auto Save
            }
        }
    });
}

function deleteJenisSurat(val) {
    Swal.fire({
        title: 'Hapus?',
        text: `Hapus "${val}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            globalData.jenisSurat = globalData.jenisSurat.filter(item => item !== val);
            renderJenisSuratSettings();
            pushAutoSave('Jenis surat dihapus'); // Auto Save
        }
    });
}


// === USER MANAGEMENT LOGIC ===
const modalUserElement = document.getElementById('modalUser');
let modalUser;
if (modalUserElement) {
    modalUser = new bootstrap.Modal(modalUserElement);
}

function renderUserTable() {
    const tbody = document.querySelector('#tableUsers tbody');
    tbody.innerHTML = '';
    userList.forEach(u => {
        tbody.innerHTML += `
            <tr>
                <td class="fw-bold small">${u.username}</td>
                <td class="small">${u.nama}</td>
                <td><span class="badge ${u.role === 'Super Admin' ? 'bg-warning text-dark' : 'bg-secondary'}">${u.role}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-dark me-1" onclick="editUser('${u.username}')"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.username}')"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `;
    });
}

function openUserModal() {
    document.getElementById('formUser').reset();
    document.getElementById('isUserEdit').value = "false";
    document.getElementById('modalUserTitle').innerText = "Tambah User Baru";
    document.getElementById('uUsername').disabled = false;
    document.getElementById('uPasswordHelp').innerText = "Password wajib diisi untuk user baru.";
    if(modalUser) modalUser.show();
}

function editUser(username) {
    const user = userList.find(u => u.username === username);
    if(!user) return;

    document.getElementById('isUserEdit').value = "true";
    document.getElementById('modalUserTitle').innerText = "Edit User";
    
    document.getElementById('uUsername').value = user.username;
    document.getElementById('uUsername').disabled = true; 
    document.getElementById('uNama').value = user.nama;
    document.getElementById('uRole').value = user.role;
    document.getElementById('uPassword').value = "";
    document.getElementById('uPasswordHelp').innerText = "Biarkan kosong jika password tidak berubah.";
    
    if(modalUser) modalUser.show();
}

function saveUser() {
    const isEdit = document.getElementById('isUserEdit').value === "true";
    const username = document.getElementById('uUsername').value;
    const password = document.getElementById('uPassword').value;
    const nama = document.getElementById('uNama').value;
    const role = document.getElementById('uRole').value;

    if(!username || !nama) {
        Swal.fire('Error', 'Username dan Nama wajib diisi', 'error');
        return;
    }
    if (!isEdit && !password) {
        Swal.fire('Error', 'Password wajib diisi untuk user baru', 'error');
        return;
    }

    const payload = {
        action: 'manipulateUser',
        mode: 'simpan',
        isNew: !isEdit,
        targetUsername: username,
        targetPassword: password,
        targetNama: nama,
        targetRole: role
    };

    showLoading(true);
    if(modalUser) modalUser.hide();

    fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(resp => {
        showLoading(false);
        if (resp.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: resp.message,
                timer: 2000,
                showConfirmButton: false
            });
            loadUsers();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: resp.message
            });
        }
    });
}

function deleteUser(username) {
    if (username === currentUser.username) {
        Swal.fire('Error', 'Anda tidak bisa menghapus akun sendiri!', 'error');
        return;
    }

    Swal.fire({
        title: 'Hapus User?',
        html: `Anda akan menghapus user <b>${username}</b>.<br>Masukkan password Super Admin Anda untuk konfirmasi:`,
        input: 'password',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Hapus',
        reverseButtons: true,
        preConfirm: (pass) => {
            if (!pass) {
                Swal.showValidationMessage('Password wajib diisi');
                return false;
            }
            return pass;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true);
            fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'manipulateUser',
                    mode: 'hapus',
                    targetUsername: username,
                    adminUsername: currentUser.username,
                    adminPassword: result.value
                })
            })
            .then(res => res.json())
            .then(resp => {
                showLoading(false);
                if(resp.status === 'success') {
                    Swal.fire('Terhapus', resp.message, 'success');
                    loadUsers();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal',
                        text: resp.message
                    });
                }
            });
        }
    });
}

// === RENDERING UI ===

function showTab(tabName) {
    document.querySelectorAll('.content-tab').forEach(el => el.classList.add('d-none'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + tabName).classList.remove('d-none');
    document.getElementById('nav-' + tabName).classList.add('active');
    
    const titles = {
        'dashboard': ['Statistik Surat', 'Kounter jumlah Surat Masuk dan Surat Keluar'],
        'suratMasuk': ['Pencatatan Surat Masuk', 'Daftar surat yang masuk/diterima'],
        'suratKeluar': ['Pencatatan Surat Keluar', 'Daftar surat yang keluar/diterbitkan'],
        'suratKeputusan': ['Pencatatan Surat Keputusan', 'Daftar Surat Keputusan (SK)'], // <--- TAMBAHAN BARU
        'pengaturan': ['Pengaturan Sistem', 'Konfigurasi aplikasi'],
        'perjadin': ['Pencatatan Data Perjalanan Dinas', 'Daftar TS, SPT, & SPPD'],
        'npd': ['Pencatatan Nota Pencairan Dana (NPD)', 'Daftar NPD yang diterbitkan'] 
    };

    document.getElementById('pageTitle').innerText = titles[tabName][0];
    document.getElementById('pageTitle').nextElementSibling.innerText = titles[tabName][1];

    // LOGIKA FAB (Floating Action Button)
    const fab = document.getElementById('fabTambah');
    if (tabName === 'suratMasuk') {
        fab.style.display = 'flex';
        fab.style.backgroundColor = '#059669'; // Hijau
    } else if (tabName === 'suratKeluar') {
        fab.style.display = 'flex';
        fab.style.backgroundColor = '#ea580c'; // Orange
    } else if (tabName === 'suratKeluar') {
        fab.style.display = 'flex';
        fab.style.backgroundColor = '#ea580c'; // Orange
    } else if (tabName === 'suratKeputusan') { // <--- TAMBAHAN BARU
        fab.style.display = 'flex';
        fab.style.backgroundColor = '#dc2626'; // Merah Kirmizi (SK)    
    } else if (tabName === 'perjadin') {
        fab.style.display = 'flex';
        fab.style.backgroundColor = '#3b82f6'; // Biru (Warna Perjadin)
    } else if (tabName === 'npd') {
        fab.style.display = 'flex';
        fab.style.backgroundColor = '#8b5cf6'; // Warna Ungu untuk NPD
    } else {
        fab.style.display = 'none'; // Sembunyikan di Dashboard/Pengaturan
    }
                        
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Variable Global untuk Chart agar bisa di-update
let chartInstanceMasuk = null;
let chartInstanceKeluar = null;

function renderDashboard() {
    // 1. UPDATE KARTU STATISTIK (TOTAL & BULANAN)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Hitung Masuk
    const totalMasuk = globalData.suratMasuk.length;
    const bulanMasuk = globalData.suratMasuk.filter(row => {
        const d = new Date(row.values[2]);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    // Hitung Keluar
    const totalKeluar = globalData.suratKeluar.length;
    const bulanKeluar = globalData.suratKeluar.filter(row => {
        const d = new Date(row.values[2]);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    document.getElementById('countMasuk').innerText = totalMasuk;
    document.getElementById('countMasukMonth').innerText = bulanMasuk;
    document.getElementById('countKeluar').innerText = totalKeluar;
    document.getElementById('countKeluarMonth').innerText = bulanKeluar;

    // 2. UPDATE TABEL TERBARU (5 DATA TERAKHIR)
    // Ambil 5 data teratas (karena data sudah di-reverse/terbaru di atas dari server)
    const recentMasuk = globalData.suratMasuk.slice(0, 5);
    const recentKeluar = globalData.suratKeluar.slice(0, 5);

    const tbodyMasuk = document.getElementById('listRecentMasuk');
    tbodyMasuk.innerHTML = '';
    if(recentMasuk.length === 0) {
        tbodyMasuk.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Belum ada data</td></tr>';
    } else {
        recentMasuk.forEach(item => {
            const r = item.values;
            const tgl = new Date(r[2]).toLocaleDateString('id-ID', {day:'numeric', month:'short'});
            tbodyMasuk.innerHTML += `
                <tr>
                    <td class="text-nowrap">${tgl}</td>
                    <td class="fw-bold text-truncate" style="max-width: 100px;">${r[6]}</td> <td class="text-truncate" style="max-width: 150px;">${r[5]}</td> </tr>`;
        });
    }

    const tbodyKeluar = document.getElementById('listRecentKeluar');
    tbodyKeluar.innerHTML = '';
    if(recentKeluar.length === 0) {
        tbodyKeluar.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Belum ada data</td></tr>';
    } else {
        recentKeluar.forEach(item => {
            const r = item.values;
            const tgl = new Date(r[2]).toLocaleDateString('id-ID', {day:'numeric', month:'short'});
            tbodyKeluar.innerHTML += `
                <tr>
                    <td class="text-nowrap">${tgl}</td>
                    <td class="fw-bold text-truncate" style="max-width: 100px;">${r[8]}</td> <td class="text-truncate" style="max-width: 150px;">${r[7]}</td> </tr>`;
        });
    }

    // 3. RENDER / UPDATE CHART
    renderChartJS();
}

function renderChartJS() {
    // Helper: Hitung frekuensi per jenis surat
    const getStatsByJenis = (dataArray, colIndex) => {
        const counts = {};
        dataArray.forEach(item => {
            const jenis = item.values[colIndex]; 
            counts[jenis] = (counts[jenis] || 0) + 1;
        });
        return counts;
    };

    // Masuk (Jenis ada di index 4), Keluar (Jenis ada di index 6)
    const statsMasuk = getStatsByJenis(globalData.suratMasuk, 4);
    const statsKeluar = getStatsByJenis(globalData.suratKeluar, 6);

    // Fungsi bikin chart
    const createOrUpdateChart = (canvasId, chartInstance, label, dataObj, colorBase) => {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const labels = Object.keys(dataObj);
        const data = Object.values(dataObj);
        
        // Warna dinamis
        const bgColors = labels.map((_, i) => i % 2 === 0 ? colorBase : adjustColor(colorBase, -20));

        if (chartInstance) {
            chartInstance.data.labels = labels;
            chartInstance.data.datasets[0].data = data;
            chartInstance.update();
            return chartInstance;
        } else {
            return new Chart(ctx, {
                type: 'doughnut', // Bisa ganti 'bar', 'pie', dll
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Jumlah',
                        data: data,
                        backgroundColor: [
                            '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 12, font: {size: 10} } }
                    }
                }
            });
        }
    };

    // Helper warna (dummy function agar tidak error, atau hapus logika warna custom di atas)
    const adjustColor = (col, amt) => { return col; } 

    // Render Chart Masuk & Keluar
    chartInstanceMasuk = createOrUpdateChart('chartMasuk', chartInstanceMasuk, 'Surat Masuk', statsMasuk, '#10b981');
    chartInstanceKeluar = createOrUpdateChart('chartKeluar', chartInstanceKeluar, 'Surat Keluar', statsKeluar, '#f59e0b');
}

// --- PAGINATION LOGIC ---
function changeRowsPerPage(type, value) {
    if (type === 'masuk') {
        rowsPerPageMasuk = value === 'all' ? globalData.suratMasuk.length : parseInt(value);
        currentPageMasuk = 1;
    } else if (type === 'keluar') {
        rowsPerPageKeluar = value === 'all' ? globalData.suratKeluar.length : parseInt(value);
        currentPageKeluar = 1;
    } else if (type === 'keputusan') {  // <--- TAMBAHKAN BLOK INI
        rowsPerPageKeputusan = value === 'all' ? globalData.suratKeputusan.length : parseInt(value);
        currentPageKeputusan = 1;   
    } else if (type === 'perjadin') {
        rowsPerPagePerjadin = value === 'all' ? globalData.perjadin.length : parseInt(value);
        currentPagePerjadin = 1;
    } else if (type === 'npd') {  // <--- TAMBAHKAN BLOK INI
        rowsPerPageNpd = value === 'all' ? globalData.npd.length : parseInt(value);
        currentPageNpd = 1;    
    }
    renderTables();
}

function changePage(type, page) {
    if (type === 'masuk') currentPageMasuk = page;
    else if (type === 'keluar') currentPageKeluar = page;
    else if (type === 'keputusan') currentPageKeputusan = page; // <--- TAMBAHKAN BARIS INI
    else if (type === 'perjadin') currentPagePerjadin = page;
    else if (type === 'npd') currentPageNpd = page; // <--- TAMBAHKAN INI
    renderTables();
}

function resetPagination(type) {
    if (type === 'masuk') currentPageMasuk = 1;
    else if (type === 'keluar') currentPageKeluar = 1;
    else if (type === 'keputusan') currentPageKeputusan = 1; // <--- TAMBAHKAN BARIS INI
    else if (type === 'perjadin') currentPagePerjadin = 1;
    else if (type === 'npd') currentPageNpd = 1; // <--- TAMBAHKAN INI
}

function renderPaginationControls(totalItems, currentPage, rowsPerPage, type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalItems);

    let controls = `
        <div class="rows-per-page d-flex align-items-center">
            Tampilkan 
            <select class="mx-2" onchange="changeRowsPerPage('${type}', this.value)">
                <option value="5" ${rowsPerPage === 5 ? 'selected' : ''}>5</option>
                <option value="10" ${rowsPerPage === 10 ? 'selected' : ''}>10</option>
                <option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50</option>
                <option value="all" ${rowsPerPage > 50 ? 'selected' : ''}>All</option>
            </select>
            data
        </div>
        <div class="d-flex align-items-center">
            <span class="me-3">Menampilkan ${startItem}-${endItem} dari ${totalItems}</span>
            <nav>
                <ul class="pagination pagination-sm mb-0">
                    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                        <button class="page-link" onclick="changePage('${type}', ${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>
                    </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
        if(totalPages <= 7 || i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            controls += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <button class="page-link" onclick="changePage('${type}', ${i})">${i}</button>
                </li>
            `;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
            controls += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
    }

    controls += `
                    <li class="page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}">
                        <button class="page-link" onclick="changePage('${type}', ${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>
                    </li>
                </ul>
            </nav>
        </div>
    `;
    
    container.innerHTML = controls;
}

function renderTables() {
    // -- SEARCH --
    const termMasuk = document.getElementById('searchMasuk') ? document.getElementById('searchMasuk').value.toLowerCase() : '';
    const termKeluar = document.getElementById('searchKeluar') ? document.getElementById('searchKeluar').value.toLowerCase() : '';
    const termKeputusan = document.getElementById('searchKeputusan') ? document.getElementById('searchKeputusan').value.toLowerCase() : ''; // <--- TAMBAHAN BARU
    const termPerjadin = document.getElementById('searchPerjadin') ? document.getElementById('searchPerjadin').value.toLowerCase() : '';
    const termNpd = document.getElementById('searchNpd') ? document.getElementById('searchNpd').value.toLowerCase() : '';

    // LOGIKA PENCARIAN BARU (DIPERLUAS)

    // --- Filter Masuk ---
    const filteredMasuk = globalData.suratMasuk.filter(row => {
        const textData = (
            (row.values[3] || "") + " " + // Nomor
            (row.values[4] || "") + " " + // Jenis
            (row.values[5] || "") + " " + // Perihal
            (row.values[6] || "") + " " + // Pengirim
            (row.values[7] || "")         // Diteruskan
        ).toLowerCase();
        return textData.includes(termMasuk);
    });

    // --- Filter Keluar ---
    const filteredKeluar = globalData.suratKeluar.filter(row => {
        const textData = (
            (row.values[5] || "") + " " + // No Lengkap
            (row.values[6] || "") + " " + // Jenis
            (row.values[7] || "") + " " + // Perihal
            (row.values[8] || "") + " " + // Tujuan
            (row.values[9] || "")         // Asal Naskah
        ).toLowerCase();
        return textData.includes(termKeluar);
    });

    // --- Filter Surat Keputusan (Struktur Kolom Sama dengan Surat Keluar) ---
    const filteredKeputusan = globalData.suratKeputusan.filter(row => {
        const textData = (
            (row.values[5] || "") + " " + // No Lengkap
            (row.values[6] || "") + " " + // Jenis
            (row.values[7] || "") + " " + // Perihal
            (row.values[8] || "") + " " + // Tujuan / Sasaran
            (row.values[9] || "")         // Asal Naskah
        ).toLowerCase();
        return textData.includes(termKeputusan);
    });

    // Filter Perjadin: Cek Maksud(5), Tempat(6), Daerah(7), NoSPT(8), Nama Personil (di dalam JSON col 12)
    const filteredPerjadin = globalData.perjadin.filter(row => {
        const vals = row.values;
        // Cek nama di dalam JSON Personil
        let personilNames = "";
        try {
            const pList = JSON.parse(vals[16]);
            personilNames = pList.map(p => p.nama).join(" ");
        } catch(e) {}

        const textData = (
            (vals[5] || "") + " " + // Maksud
            (vals[6] || "") + " " + // Tempat
            (vals[7] || "") + " " + // Daerah
            (vals[8] || "") + " " + // No SPT
            personilNames
        ).toLowerCase();
        return textData.includes(termPerjadin);
    });

    // --- Filter NPD ---
    const filteredNpd = globalData.npd.filter(row => {
        const textData = (
            (row.values[4] || "") + " " + // Nomor NPD Lengkap
            (row.values[5] || "") + " " + // Asal Naskah
            (row.values[6] || "")         // Keperluan
        ).toLowerCase();
        return textData.includes(termNpd);
    });

    // -- PAGINATION SLICE --
    const startMasuk = (currentPageMasuk - 1) * rowsPerPageMasuk;
    const paginatedMasuk = filteredMasuk.slice(startMasuk, startMasuk + rowsPerPageMasuk);

    const startKeluar = (currentPageKeluar - 1) * rowsPerPageKeluar;
    const paginatedKeluar = filteredKeluar.slice(startKeluar, startKeluar + rowsPerPageKeluar);

    // Potongan Halaman Surat Keputusan
    const startKeputusan = (currentPageKeputusan - 1) * rowsPerPageKeputusan;
    const paginatedKeputusan = filteredKeputusan.slice(startKeputusan, startKeputusan + rowsPerPageKeputusan);

    // Pagination Perjadin
    const startPerjadin = (currentPagePerjadin - 1) * rowsPerPagePerjadin;
    const paginatedPerjadin = filteredPerjadin.slice(startPerjadin, startPerjadin + rowsPerPagePerjadin);

    // Pagination NPD
    const startNpd = (currentPageNpd - 1) * rowsPerPageNpd;
    const paginatedNpd = filteredNpd.slice(startNpd, startNpd + rowsPerPageNpd);

    // -- RENDER ROWS HELPER --

    const createRow = (rowObj, type) => {
        const row = rowObj.values;
        const realRow = rowObj.rowNumber;
        
        // Tentukan index URL File & Keterangan
        // Masuk: URL=9, Ket=8. Keluar: URL=11, Ket=10.
        const idxUrl = type === 'masuk' ? 9 : 11;
        const idxKet = type === 'masuk' ? 8 : 10;
        
        // Tombol Lihat File
        let btnFile = row[idxUrl] ? 
            `<button class="btn-circle btn-circle-primary" onclick="previewFile('${row[idxUrl]}')" title="Pratinjau File"><i class="fas fa-eye"></i></button>` : 
            `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;
        
        // Format Tanggal
        let tgl = new Date(row[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: '2-digit' });
        const badgeClass = type === 'masuk' ? 'badge-masuk' : 'badge-keluar';

        // --- STYLE KETERANGAN (SERAGAM PERJADIN) ---
        const valKet = row[idxKet];
        // Jika ada isinya: Merah, Miring, Ikon Info. Jika kosong: strip atau kosong.
        const ketHtml = valKet ? 
            `<div class="small text-danger fst-italic text-wrap" style="line-height:1.2;">
                <i class="fas fa-info-circle me-1"></i>${valKet}
            </div>` : ""; 

        if (type === 'masuk') {
            // TABLE ROW SURAT MASUK
            // 2:No, 3:Jenis, 4:Perihal, 5:Pengirim, 6:Diteruskan
            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark small">${row[3]}</div>
                        <small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small>
                    </td>
                    <td>
                        <span class="badge ${badgeClass} mb-1">${row[4]}</span>
                        <div class="small text-dark text-wrap">${row[5]}</div>
                    </td>
                    <td><div class="small">${row[6]}</div></td>
                    <td><span class="badge bg-light text-dark border">${row[7]}</span></td> 
                    
                    <td>${ketHtml}</td>
                    
                    <td class="text-center">
                        <div class="d-flex justify-content-center gap-2">
                            ${btnFile}
                            <button class="btn-circle btn-circle-warning" onclick="editData('${type}', ${realRow})"><i class="fas fa-pen"></i></button>
                            <button class="btn-circle btn-circle-danger" onclick="hapusData('${type}', ${realRow})"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // TABLE ROW SURAT KELUAR
            
            // --- LOGIKA WARNA BIRU NOMOR URUT SURAT KELUAR ---
            let displayNoKeluar = row[5] || "";
            if (displayNoKeluar.includes('/')) {
                let parts = displayNoKeluar.split('/');
                // Nomor urut Surat Keluar ada di posisi ke-2 (index 1), contoh: 800.1.3/001/BKPSDM...
                if (parts.length > 1) {
                    parts[1] = `<span class="text-primary fw-bold">${parts[1]}</span>`;
                    displayNoKeluar = parts.join('/');
                }
            }

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-dark small">${displayNoKeluar}</div> 
                        <small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small>
                    </td>
                    <td>
                        <span class="badge ${badgeClass} mb-1">${row[6]}</span>
                        <div class="small text-dark text-wrap">${row[7]}</div>
                    </td>
                    <td><div class="small">${row[8]}</div></td>
                    <td><span class="badge bg-light text-dark border">${row[9]}</span></td> 
                    
                    <td>${ketHtml}</td>
                    
                    <td class="text-center">
                        <div class="d-flex justify-content-center gap-2">
                            ${btnFile}
                            <button class="btn-circle btn-circle-warning" onclick="editData('${type}', ${realRow})"><i class="fas fa-pen"></i></button>
                            <button class="btn-circle btn-circle-danger" onclick="hapusData('${type}', ${realRow})"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }
    };

    // --- UPDATE: FUNGSI RENDER BARIS PERJADIN (VERSI INDEX BARU) ---
    const createRowPerjadin = (rowObj) => {
        const r = rowObj.values;
        const realRow = rowObj.rowNumber;
        
        // Format: 20 Feb 26
        const dateOpts = { timeZone: 'Asia/Makassar', day:'numeric', month:'short', year: '2-digit' };
        
        let tglStart = new Date(r[3]).toLocaleDateString('id-ID', dateOpts);
        let tglDisplay = tglStart;
        let duration = "1 Hari";
        
        if (r[2] !== 'Dalam Daerah' && r[4]) { 
            const end = new Date(r[4]);
            const start = new Date(r[3]);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
            
            let tglEnd = end.toLocaleDateString('id-ID', dateOpts);
            tglDisplay += ` <br><span class="text-muted" style="font-weight:normal;">s.d.</span><br> ${tglEnd}`;
            duration = `${diffDays} Hari`;
        }

        let badgeClass = "bg-light text-dark border"; 
        if (r[2] === 'Dalam Daerah') badgeClass = "badge-hijau-muda";
        else if (r[2] === 'Dalam Provinsi') badgeClass = "badge-biru-muda";
        else if (r[2] === 'Luar Provinsi') badgeClass = "badge-ungu-muda";
        else if (r[2] === 'Luar Negeri') badgeClass = "badge-coklat-muda";

        // Index 16: Personil JSON
        let personilHtml = "";
        try {
            const pList = JSON.parse(r[16]);
            
            // --- TAMBAHAN BARU: Urutkan No SPPD dari Besar ke Kecil (Descending) ---
            pList.sort((a, b) => {
                // Ambil angka dari string (mengatasi format range seperti "005-008")
                const getNum = (str) => parseInt(str ? String(str).split('-')[0].replace(/\D/g, '') : 0) || 0;
                return getNum(b.no) - getNum(a.no);
            });
            
            pList.forEach(p => {
                personilHtml += `
                    <div class="mb-1 d-flex align-items-center" style="line-height:1.2;">
                        <span class="badge ${badgeClass} me-2" style="font-family:monospace; font-size: 0.75rem; padding: 4px 6px;">${p.no || '-'}</span>
                        <div>
                            <div class="fw-bold small text-dark">${p.nama}</div>
                            <div class="text-muted" style="font-size:0.7rem;">${p.nip}</div>
                        </div>
                    </div>
                `;
            });
        } catch(e) { personilHtml = "<em class='text-danger'>Error Data Personil</em>"; }

        // Index 14: Asal Naskah
        const badgeAsal = `<span class="badge bg-light text-dark border">${r[14]}</span>`;
        
        // Index 15: Keterangan
        let statusHtml = r[15] ? `<div class="mt-2 small text-danger fst-italic"><i class="fas fa-info-circle me-1"></i>${r[15]}</div>` : "";

        // Helper: Format angka jadi minimal 3 digit (contoh: 1 -> 001, 1000 -> 1000)
        const padNo = (num) => {
            return num ? String(num).padStart(3, '0') : '';
        };

        // Dokumen Dasar (Index 9: No Urut TS, Index 12: No Urut SPT)
        // Kita gunakan No Urut (Col J/M) agar bisa diformat rapi, 
        // digabung dengan Kode & Tahun dari string lengkap (Col K/N)
        
        let displayTS = "";
        if (r[9]) { // Jika ada No Urut TS
            const parts = (r[10] || "").split('/'); 
            if(parts.length >= 4) {
                displayTS = `${parts[0]}/<span class="text-primary fw-bold">${padNo(r[9])}</span>/${parts[2]}/${parts[3]}`;
            } else {
                displayTS = r[10]; // Fallback jika format beda
            }
        }

        let displaySPT = "";
        if (r[12]) { // Jika ada No Urut SPT
            const parts = (r[13] || "").split('/');
            if(parts.length >= 4) {
                displaySPT = `${parts[0]}/<span class="text-primary fw-bold">${padNo(r[12])}</span>/${parts[2]}/${parts[3]}`;
            } else {
                displaySPT = r[13];
            }
        }

        // UPDATE: Sembunyikan label jika kosong, tampilkan strip (-) jika keduanya kosong
        const docHtml = `
            ${displayTS ? `<div class="small text-dark mb-1" style="font-size: 0.75rem;"><span class="fw-bold text-secondary">TS:</span> ${displayTS}</div>` : ''}
            ${displaySPT ? `<div class="small text-dark" style="font-size: 0.75rem;"><span class="fw-bold text-secondary">SPT:</span> ${displaySPT}</div>` : ''}
            ${!displayTS && !displaySPT ? `<span class="text-muted fst-italic small">-</span>` : ''}
        `;

        // Index 17: URL File
        let btnFile = r[17] ? 
            `<button class="btn-circle btn-circle-primary" onclick="previewFile('${r[17]}')" title="Lihat File"><i class="fas fa-eye"></i></button>` : 
            `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;

        return `
            <tr>
                <td style="vertical-align: top;">
                    <div class="fw-bold text-dark small" style="font-size: 0.8rem; line-height: 1.4;">${tglDisplay}</div>
                    <div class="mt-1"><span class="badge bg-light text-secondary border">${duration}</span></div>
                    <div class="mt-2"><span class="badge ${badgeClass}">${r[2]}</span></div>
                </td>
                <!-- PERBAIKAN DI SINI: Menggunakan d-flex agar ikon dan teks terpisah posisinya -->
                <td style="vertical-align: top;">
                    <div class="small fw-bold text-primary mb-1 text-wrap">${r[5]}</div>
                    <div class="small text-muted d-flex align-items-start gap-1">
                        <i class="fas fa-map-marker-alt text-danger" style="margin-top: 3px;"></i> 
                        <div>${[r[6], r[7]].filter(Boolean).join(', ')}</div>
                    </div>
                </td>
                <td style="vertical-align: top;">${docHtml}</td>
                <td style="vertical-align: top;">${personilHtml}</td>
                <td style="vertical-align: top;">${badgeAsal} ${statusHtml}</td>
                <td class="text-center" style="vertical-align: top;">
                    <div class="d-flex justify-content-center gap-2">
                        ${btnFile}
                        <button class="btn-circle btn-circle-warning" onclick="editPerjadin(${realRow})"><i class="fas fa-pen"></i></button>
                        <button class="btn-circle btn-circle-danger" onclick="hapusPerjadin(${realRow})"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>
        `;
    };

    // --- FUNGSI RENDER BARIS NPD ---
    const createRowNpd = (rowObj) => {
        const r = rowObj.values;
        const realRow = rowObj.rowNumber;
        
        // Format Tanggal Naskah
       const tgl = new Date(r[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: '2-digit' });
        
        // --- LOGIKA WARNA BIRU NOMOR URUT NPD ---
        let displayNoNpd = r[4] || "";
        if (displayNoNpd.includes('/')) {
            let parts = displayNoNpd.split('/');
            // Nomor urut NPD ada di posisi paling depan (index 0), contoh: 001/NPD/BKPSDM...
            if (parts.length > 0) {
                parts[0] = `<span class="text-primary fw-bold">${parts[0]}</span>`;
                displayNoNpd = parts.join('/');
            }
        }

        // Tombol File
        let btnFile = r[7] ? 
            `<button class="btn-circle btn-circle-primary" onclick="previewFile('${r[7]}')" title="Lihat Dokumen"><i class="fas fa-eye"></i></button>` : 
            `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;

        return `
            <tr>
                <td style="vertical-align: top;">
                    <div class="fw-bold text-dark small">${displayNoNpd}</div> 
                    <small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small>
                </td>
                
                <!-- DIPINDAH: Keperluan sekarang di kolom ke-2 -->
                <td style="vertical-align: top;">
                    <div class="small text-dark text-wrap" style="line-height: 1.4;">${r[6]}</div>
                </td>

                <!-- DIPINDAH: Asal Naskah sekarang di kolom ke-3 (Sebelum Aksi) -->
                <td style="vertical-align: top;">
                    <span class="badge bg-light text-dark border">${r[5]}</span>
                </td>
                
                <td class="text-center" style="vertical-align: top;">
                    <div class="d-flex justify-content-center gap-2">
                        ${btnFile}
                        <button class="btn-circle btn-circle-warning" onclick="editNpd(${realRow})"><i class="fas fa-pen"></i></button>
                        <button class="btn-circle btn-circle-danger" onclick="hapusNpd(${realRow})"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>
        `;
    };

    // --- FUNGSI RENDER CARD MOBILE NPD ---
    const createCardNpd = (rowObj) => {
        const r = rowObj.values;
        const realRow = rowObj.rowNumber;
        
        // Format Tanggal (Format lengkap untuk di kartu)
        const tgl = new Date(r[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: 'numeric' });
        
        // Logika Warna Biru Nomor Urut (Sama dengan versi Desktop)
        let displayNoNpd = r[4] || "";
        if (displayNoNpd.includes('/')) {
            let parts = displayNoNpd.split('/');
            if (parts.length > 0) {
                parts[0] = `<span class="text-primary fw-bold">${parts[0]}</span>`;
                displayNoNpd = parts.join('/');
            }
        }

        // Tombol File versi Mobile (Melebar)
        let btnFile = r[7] ? 
            `<button class="btn btn-sm btn-outline-primary flex-fill fw-bold" onclick="previewFile('${r[7]}')"><i class="fas fa-eye me-1"></i>Lihat Dokumen</button>` : 
            `<button class="btn btn-sm btn-outline-secondary flex-fill" disabled><i class="fas fa-eye-slash me-1"></i>Kosong</button>`;

        return `
            <div class="card shadow-sm mb-3 border-0" style="border-radius: 12px; overflow: hidden;">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <div class="fw-bold text-dark" style="font-size: 1.05rem;">${displayNoNpd}</div>
                            <div class="small text-muted mt-1"><i class="far fa-calendar-alt me-1"></i> ${tgl}</div>
                        </div>
                        <span class="badge bg-success bg-opacity-10 text-success border border-success">${r[5]}</span>
                    </div>
                    
                    <div class="small text-dark mb-3 pb-3 border-bottom" style="line-height: 1.5;">
                        ${r[6]}
                    </div>
                    
                    <div class="d-flex gap-2">
                        ${btnFile}
                        <button class="btn btn-sm btn-warning text-white px-3" onclick="editNpd(${realRow})"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-sm btn-danger px-3" onclick="hapusNpd(${realRow})"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            </div>
        `;
    };

    // Render Masuk
    const tbodyMasuk = document.querySelector('#tableMasuk tbody');
    tbodyMasuk.innerHTML = '';
    if (paginatedMasuk.length === 0) {
        tbodyMasuk.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted"><i class="fas fa-search fa-3x mb-3 d-block opacity-25"></i>Data tidak ditemukan</td></tr>';
    } else {
        paginatedMasuk.forEach(rowObj => tbodyMasuk.innerHTML += createRow(rowObj, 'masuk'));
    }
    renderPaginationControls(filteredMasuk.length, currentPageMasuk, rowsPerPageMasuk, 'masuk', 'paginationMasuk');

    // Render Keluar
    const tbodyKeluar = document.querySelector('#tableKeluar tbody');
    tbodyKeluar.innerHTML = '';
    if (paginatedKeluar.length === 0) {
        tbodyKeluar.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted"><i class="fas fa-search fa-3x mb-3 d-block opacity-25"></i>Data tidak ditemukan</td></tr>';
    } else {
        paginatedKeluar.forEach(rowObj => tbodyKeluar.innerHTML += createRow(rowObj, 'keluar'));
    }
    renderPaginationControls(filteredKeluar.length, currentPageKeluar, rowsPerPageKeluar, 'keluar', 'paginationKeluar');
    
    // Render Perjadin
    const tbodyPerjadin = document.querySelector('#tablePerjadin tbody');
    if(tbodyPerjadin) {
        tbodyPerjadin.innerHTML = '';
        if (paginatedPerjadin.length === 0) {
            tbodyPerjadin.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted">Data tidak ditemukan</td></tr>';
        } else {
            paginatedPerjadin.forEach(rowObj => tbodyPerjadin.innerHTML += createRowPerjadin(rowObj));
        }
        renderPaginationControls(filteredPerjadin.length, currentPagePerjadin, rowsPerPagePerjadin, 'perjadin', 'paginationPerjadin');
    }

    // Render NPD ke Desktop dan Mobile
    const tbodyNpd = document.querySelector('#tableNpd tbody');
    const mobileNpd = document.getElementById('mobileNpdContainer');
    
    if(tbodyNpd && mobileNpd) {
        tbodyNpd.innerHTML = '';
        mobileNpd.innerHTML = ''; 
        
        if (paginatedNpd.length === 0) {
            tbodyNpd.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-muted">Data tidak ditemukan</td></tr>';
            mobileNpd.innerHTML = '<div class="text-center py-5 text-muted bg-white rounded shadow-sm">Data tidak ditemukan</div>';
        } else {
            paginatedNpd.forEach(rowObj => {
                tbodyNpd.innerHTML += createRowNpd(rowObj);   // Isi ke tabel PC
                mobileNpd.innerHTML += createCardNpd(rowObj);  // Isi ke kartu HP
            });
        }
        renderPaginationControls(filteredNpd.length, currentPageNpd, rowsPerPageNpd, 'npd', 'paginationNpd');
    }

    // --- RENDER SURAT KEPUTUSAN ---
    const tbodyKeputusan = document.querySelector('#tableKeputusan tbody');
    if (tbodyKeputusan) {
        tbodyKeputusan.innerHTML = '';
        if (paginatedKeputusan.length === 0) {
            tbodyKeputusan.innerHTML = '<tr><td colspan="6" class="text-center py-5 text-muted"><i class="fas fa-search fa-3x mb-3 d-block opacity-25"></i>Data tidak ditemukan</td></tr>';
        } else {
            paginatedKeputusan.forEach(rowObj => {
                const row = rowObj.values;
                const realRow = rowObj.rowNumber;
                
                // Tombol Lihat File (URL di indeks 11)
                let btnFile = row[11] ? 
                    `<button class="btn-circle btn-circle-primary" onclick="previewFile('${row[11]}')" title="Pratinjau File"><i class="fas fa-eye"></i></button>` : 
                    `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;
                
                // Format Tanggal
                let tgl = new Date(row[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: '2-digit' });
                
                // Catatan Tambahan Keterangan
                const valKet = row[10];
                const ketHtml = valKet ? 
                    `<div class="small text-danger fst-italic text-wrap" style="line-height:1.2;"><i class="fas fa-info-circle me-1"></i>${valKet}</div>` : ""; 

                // Format Pewarnaan Biru Nomor Urut
                let displayNoKeputusan = row[5] || "";
                if (displayNoKeputusan.includes('/')) {
                    let parts = displayNoKeputusan.split('/');
                    if (parts.length > 1) {
                        parts[1] = `<span class="text-primary fw-bold">${parts[1]}</span>`;
                        displayNoKeputusan = parts.join('/');
                    }
                }

                tbodyKeputusan.innerHTML += `
                    <tr>
                        <td style="vertical-align: top; padding-top: 12px;">
                            <div class="fw-bold text-dark small">${displayNoKeputusan}</div> 
                            <small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small>
                        </td>
                        <td style="vertical-align: top; padding-top: 12px;">
                            <span class="badge badge-keputusan mb-1">${row[6]}</span>
                            <div class="small text-dark text-wrap">${row[7]}</div>
                        </td>
                        <td style="vertical-align: top; padding-top: 12px;"><div class="small">${row[8]}</div></td>
                        <td style="vertical-align: top; padding-top: 12px;"><span class="badge bg-light text-dark border">${row[9]}</span></td> 
                        <td style="vertical-align: top; padding-top: 12px;">${ketHtml}</td>
                        <td class="text-center" style="vertical-align: top; padding-top: 12px;">
                            <div class="d-flex justify-content-center gap-2">
                                ${btnFile}
                                <button class="btn-circle btn-circle-warning" onclick="editData('keputusan', ${realRow})"><i class="fas fa-pen"></i></button>
                                <button class="btn-circle btn-circle-danger" onclick="hapusData('keputusan', ${realRow})"><i class="fas fa-trash-alt"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        renderPaginationControls(filteredKeputusan.length, currentPageKeputusan, rowsPerPageKeputusan, 'keputusan', 'paginationKeputusan');
    }
}			

function populateDropdown() {
    const sel = document.getElementById('inpJenis');
    sel.innerHTML = '<option value="">Pilih</option>';
    globalData.jenisSurat.forEach(jenis => {
        let opt = document.createElement('option');
        opt.value = jenis;
        opt.innerText = jenis;
        sel.appendChild(opt);
    });
}

// === DRAG & DROP ZONE LOGIC (UPDATED) ===
function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZoneArea');
    const fileInput = document.getElementById('inpFile');
    
    // Helper: Validasi Ukuran File (Maks 2MB)
    const validateFileSize = (file) => {
        const maxSize = 2 * 1024 * 1024; // 2 MB
        if (file.size > maxSize) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal Upload',
                text: 'Ukuran file terlalu besar (lebih dari 2 MB). Silakan dikompres terlebih dahulu.'
            });
            fileInput.value = ""; // Reset input
            resetDropZone();      // Kembalikan tampilan ke awal
            return false;
        }
        return true;
    };
    
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Saat file dipilih lewat tombol browse
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (validateFileSize(file)) {
                updateDropZoneUI(file.name);
            }
        }
    });

    // Event Drag & Drop standar
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    // Saat file di-drop
    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            // Validasi dulu sebelum diterima
            if (validateFileSize(file)) {
                fileInput.files = e.dataTransfer.files; // Assign file ke input
                updateDropZoneUI(file.name);
            }
        }
    });

    function updateDropZoneUI(fileName) {
        document.getElementById('dropZoneText').style.display = 'none';
        document.getElementById('fileSelectedInfo').style.display = 'flex';
        document.getElementById('fileNameDisplay').innerText = fileName;
    }
}

function resetDropZone() {
    document.getElementById('dropZoneText').style.display = 'block';
    document.getElementById('fileSelectedInfo').style.display = 'none';
    document.getElementById('inpFile').value = "";
}

// --- DRAG & DROP KHUSUS PERJADIN ---
function setupDragAndDropPerjadin() {
    const dropZone = document.getElementById('dropZonePerjadin');
    const fileInput = document.getElementById('pFile'); // ID input file di form Perjadin
    
    // Trigger Klik
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Validasi Ukuran (Helper sama dengan yang lama)
    const validateFileSize = (file) => {
        if (file.size > 2 * 1024 * 1024) {
            Swal.fire({ icon: 'error', title: 'Gagal Upload', text: 'Ukuran file max 2 MB.' });
            fileInput.value = "";
            resetDropZonePerjadin();
            return false;
        }
        return true;
    };

    // Saat file dipilih lewat browse
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            if (validateFileSize(fileInput.files[0])) {
                updateUI(fileInput.files[0].name);
            }
        }
    });

    // Event Drag
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });
    ['dragenter', 'dragover'].forEach(evt => dropZone.classList.add('dragover'));
    ['dragleave', 'drop'].forEach(evt => dropZone.classList.remove('dragover'));

    // Saat Drop
    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (validateFileSize(file)) {
                fileInput.files = e.dataTransfer.files;
                updateUI(file.name);
            }
        }
    });

    function updateUI(name) {
        document.getElementById('dropZoneTextPerjadin').style.display = 'none';
        document.getElementById('fileInfoPerjadin').style.display = 'flex';
        document.getElementById('fileNamePerjadin').innerText = name;
    }
}

function resetDropZonePerjadin() {
    document.getElementById('dropZoneTextPerjadin').style.display = 'block';
    document.getElementById('fileInfoPerjadin').style.display = 'none';
    document.getElementById('pFile').value = "";
    document.getElementById('fileHelpPerjadin').innerText = "";
}

// === MODAL & CRUD ===
const modalSuratElement = document.getElementById('modalSurat');
const dlModalElement = document.getElementById('modalDownload');
let myModal, dlModal;

if (modalSuratElement) myModal = new bootstrap.Modal(modalSuratElement);
if (dlModalElement) dlModal = new bootstrap.Modal(dlModalElement);

function updateModalHeaderColor(type) {
    const header = document.getElementById('modalHeaderBg');
    header.classList.remove('bg-header-masuk', 'bg-header-keluar', 'bg-header-keputusan');
    
    if (type === 'masuk') header.classList.add('bg-header-masuk');
    else if (type === 'keputusan') header.classList.add('bg-header-keputusan');
    else header.classList.add('bg-header-keluar');
}

function openModal(type) {
    document.getElementById('formSurat').reset();
    resetDropZone();
    updateModalHeaderColor(type);
    
    document.getElementById('isEditMode').value = "false";
    document.getElementById('realRowNumber').value = "";
    document.getElementById('existingFileUrl').value = "";
    document.getElementById('btnSimpan').innerText = "Simpan";
    document.getElementById('fileHelpText').innerHTML = "";
    document.getElementById('previewNoSurat').innerText = "-";

    const title = document.getElementById('modalTitle');
    const katInput = document.getElementById('kategoriSurat');
    const jenisInput = document.getElementById('inpJenis'); // Ambil elemen dropdown jenis surat

    // Buka Kunci Jenis Surat secara default (akan dikunci ulang jika masuk mode SK)
    jenisInput.removeAttribute('disabled');

    // Toggle Tampilan Block
    if (type === 'masuk') {
        title.innerHTML = "<i class='fas fa-envelope-open-text me-2'></i>Input Surat Masuk";
        katInput.value = "surat_masuk";
        
        // Tampilkan blok masuk (Atas & Bawah), sembunyikan blok keluar
        document.getElementById('blockMasukAtas').classList.remove('d-none');
        document.getElementById('blockMasukBawah').classList.remove('d-none');
        document.getElementById('blockKeluarAtas').classList.add('d-none');
        document.getElementById('blockKeluarBawah').classList.add('d-none');
        
        document.getElementById('inpNomorMasuk').setAttribute('required', '');
        document.getElementById('inpPengirim').setAttribute('required', '');
        document.getElementById('inpKode').removeAttribute('required');
        document.getElementById('inpNoUrut').removeAttribute('required');
        
    } else if (type === 'keputusan') {
        title.innerHTML = "<i class='fas fa-gavel me-2'></i>Input Surat Keputusan";
        katInput.value = "surat_keputusan";
        
        // Tampilkan blok keluar (Atas & Bawah), sembunyikan blok masuk
        document.getElementById('blockKeluarAtas').classList.remove('d-none');
        document.getElementById('blockKeluarBawah').classList.remove('d-none');
        document.getElementById('blockMasukAtas').classList.add('d-none');
        document.getElementById('blockMasukBawah').classList.add('d-none');

        // Set Default Values
        document.getElementById('inpKodeLanjutan').value = "BKPSDM-BLG";
        document.getElementById('inpTahun').value = "2026";
        updatePreviewNomor();

        // Validasi
        document.getElementById('inpKode').setAttribute('required', '');
        document.getElementById('inpNoUrut').setAttribute('required', '');
        document.getElementById('inpNomorMasuk').removeAttribute('required');
        document.getElementById('inpPengirim').removeAttribute('required');

        // LAKUKAN PENGUNCIAN JENIS SURAT (Seperti kode sebelumnya)
        if (!Array.from(jenisInput.options).some(opt => opt.value === "Surat Keputusan")) {
            jenisInput.innerHTML += '<option value="Surat Keputusan">Surat Keputusan</option>';
        }
        jenisInput.value = "Surat Keputusan";
        jenisInput.setAttribute('disabled', 'true');

    } else {
        // Mode Surat Keluar
        title.innerHTML = "<i class='fas fa-paper-plane me-2'></i>Input Surat Keluar";
        katInput.value = "surat_keluar";
        
        // Tampilkan blok keluar (Atas & Bawah), sembunyikan blok masuk
        document.getElementById('blockKeluarAtas').classList.remove('d-none');
        document.getElementById('blockKeluarBawah').classList.remove('d-none');
        document.getElementById('blockMasukAtas').classList.add('d-none');
        document.getElementById('blockMasukBawah').classList.add('d-none');

        // Set Default Values
        document.getElementById('inpKodeLanjutan').value = "BKPSDM-BLG";
        document.getElementById('inpTahun').value = "2026";
        updatePreviewNomor();

        // Validasi
        document.getElementById('inpKode').setAttribute('required', '');
        document.getElementById('inpNoUrut').setAttribute('required', '');
        document.getElementById('inpNomorMasuk').removeAttribute('required');
        document.getElementById('inpPengirim').removeAttribute('required');
    }
    if(myModal) myModal.show();
}

function editData(type, rowNumber) {
    let sourceArray;
    if (type === 'masuk') sourceArray = globalData.suratMasuk;
    else if (type === 'keputusan') sourceArray = globalData.suratKeputusan;
    else sourceArray = globalData.suratKeluar;
    const dataObj = sourceArray.find(item => item.rowNumber === rowNumber);
    if (!dataObj) return;

    const rowData = dataObj.values;
    // Cek User Penginput (Masuk: Col 10, Keluar: Col 12) -> Index array mulai 0
    const idxPenginput = type === 'masuk' ? 10 : 12;
    const penginput = rowData[idxPenginput] ? rowData[idxPenginput] : "-";

    if (penginput !== "-" && penginput !== currentUser.username && currentUser.role !== 'Super Admin') {
        Swal.fire({icon: 'error', title: 'Akses Ditolak', text: `Hanya Pemilik dan Super Admin yang dapat mengedit data ini.`});
        return;
    }

    openModal(type); // Buka modal dan reset dulu
    
    document.getElementById('isEditMode').value = "true";
    document.getElementById('realRowNumber').value = rowNumber;
    document.getElementById('btnSimpan').innerText = "Perbarui";
    document.getElementById('modalTitle').innerHTML = "<i class='fas fa-pen me-2'></i>Edit Data";

    // Format Tanggal untuk input date (YYYY-MM-DD) - Force WITA
    const d = new Date(rowData[2]);
    const tzDate = new Date(d.toLocaleString("en-US", {timeZone: "Asia/Makassar"}));
    const yyyy = tzDate.getFullYear();
    const mm = String(tzDate.getMonth() + 1).padStart(2, '0');
    const dd = String(tzDate.getDate()).padStart(2, '0');
    document.getElementById('inpTanggal').value = `${yyyy}-${mm}-${dd}`;

    if (type === 'masuk') {
        document.getElementById('inpNomorMasuk').value = rowData[3];
        document.getElementById('inpJenis').value = rowData[4];
        document.getElementById('inpPerihal').value = rowData[5];
        document.getElementById('inpPengirim').value = rowData[6];
        document.getElementById('inpDiteruskan').value = rowData[7]; 
        document.getElementById('inpKeterangan').value = rowData[8];
        document.getElementById('existingFileUrl').value = rowData[9];
        checkFileStatus(rowData[9]);

    } else {
        // MAPPING KELUAR: [Time, Tgl, Kode, NoUrut, NoLengkap, Jenis, Perihal, Tujuan, AsalNaskah, Ket, URL, User]

        // Helper lokal untuk padding
        const padNo = (val) => val ? String(parseInt(val)).padStart(3, '0') : "";
        
        // Populate Field Pecahan
        document.getElementById('inpKode').value = rowData[3];
        
        // UPDATE DI SINI: Gunakan padNo
        document.getElementById('inpNoUrut').value = padNo(rowData[4]);				
                        
        // Parsing No Lengkap (Index 4) untuk ambil KodeLanjutan dan Tahun
        // Format: Kode/NoUrut/KodeLanjutan/Tahun
        const noLengkap = rowData[5] || "";
        const parts = noLengkap.split('/');
        if (parts.length >= 4) {
            document.getElementById('inpKodeLanjutan').value = parts[2];
            document.getElementById('inpTahun').value = parts[3];
        }

        document.getElementById('inpJenis').value = rowData[6];
        document.getElementById('inpPerihal').value = rowData[7];
        document.getElementById('inpTujuan').value = rowData[8];
        document.getElementById('inpAsalNaskah').value = rowData[9]; 
        document.getElementById('inpKeterangan').value = rowData[10];
        document.getElementById('existingFileUrl').value = rowData[11];
        checkFileStatus(rowData[11]);
        
        updatePreviewNomor();
    }
}

function checkFileStatus(url) {
    const fileHelp = document.getElementById('fileHelpText');
    if (url) {
        fileHelp.innerHTML = `<span class="text-success fw-bold"><i class="fas fa-check-circle"></i> File tersimpan.</span> Upload baru untuk mengganti.`;
    } else {
        fileHelp.innerText = "Belum ada file. Upload untuk menambahkan.";
    }
}

function hapusData(type, rowNumber) {
    let sourceArray;
    if (type === 'masuk') sourceArray = globalData.suratMasuk;
    else if (type === 'keputusan') sourceArray = globalData.suratKeputusan;
    else sourceArray = globalData.suratKeluar;
    
    const dataObj = sourceArray.find(item => item.rowNumber === rowNumber);
    if (!dataObj) return;
    const rowData = dataObj.values;

    // Untuk SK, urutan kolom sama seperti Surat Keluar (User Penginput ada di Index 12)
    const idxPenginput = type === 'masuk' ? 10 : 12;
    const penginput = rowData[idxPenginput] ? rowData[idxPenginput] : "-";

    if (penginput !== "-" && penginput !== currentUser.username && currentUser.role !== 'Super Admin') {
        Swal.fire({
            icon: 'error',
            title: 'Akses Ditolak',
            text: `Hanya Pemilik dan Super Admin yang dapat menghapus data ini.`,
            confirmButtonText: 'OK'
        });
        return;
    }

    let label = 'Surat Keluar';
    if (type === 'masuk') label = 'Surat Masuk';
    else if (type === 'keputusan') label = 'Surat Keputusan';

    Swal.fire({
        title: `Hapus ${label}?`,
        html: `Anda akan menghapus data <b>${label}</b> ini.<br>Masukkan Password untuk konfirmasi:`,
        input: 'password',
        inputAttributes: {
            autocomplete: 'new-password',
            autocapitalize: 'off'
        },
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal',
        reverseButtons: true,
        preConfirm: (pass) => {
            if (!pass) Swal.showValidationMessage('Password wajib diisi!');
            return pass;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true);
            
            const payload = {
                action: 'hapusSurat',
                kategori: type === 'masuk' ? 'surat_masuk' : (type === 'keputusan' ? 'surat_keputusan' : 'surat_keluar'),
                rowNumber: rowNumber,
                username: currentUser.username, 
                password: result.value
            };

            fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(resp => {
                showLoading(false);
                if(resp.status === 'success') {
                    if (type === 'masuk') document.getElementById('searchMasuk').value = "";
                    else if (type === 'keputusan') document.getElementById('searchKeputusan').value = "";
                    else document.getElementById('searchKeluar').value = "";
                    resetPagination(type);

                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil Terhapus',
                        text: resp.message,
                        timer: 2000,
                        showConfirmButton: false
                    });
                    loadData(); 
                } else {
                    showLoading(false);
                    Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message });
                }
            });
        }
    });
}

function simpanData() {
    const fileInput = document.getElementById('inpFile');
    const kategori = document.getElementById('kategoriSurat').value;
    const isEdit = document.getElementById('isEditMode').value === "true";
    
    // 1. SIAPKAN PAYLOAD DASAR (Common Fields)
    const payload = {
        action: isEdit ? 'updateSurat' : 'simpanSurat',
        kategori: kategori,
        rowNumber: document.getElementById('realRowNumber').value,
        tanggalSurat: document.getElementById('inpTanggal').value,
        jenisSurat: document.getElementById('inpJenis').value,
        perihal: document.getElementById('inpPerihal').value,
        keterangan: document.getElementById('inpKeterangan').value,
        existingFile: document.getElementById('existingFileUrl').value,
        username: currentUser.username, 
        fileName: "", fileMime: "", fileData: ""
    };

    // Array untuk menampung nama field yang kosong
    let emptyFields = [];

    // 2. VALIDASI FIELD UMUM (Wajib untuk Keduanya)
    if (!payload.tanggalSurat) emptyFields.push("Tanggal Surat");
    if (!payload.jenisSurat) emptyFields.push("Jenis Surat");
    if (!payload.perihal) emptyFields.push("Perihal / Deskripsi");

    // 3. LOGIKA PER KATEGORI
    if (kategori === 'surat_masuk') {
        // --- SURAT MASUK ---
        payload.nomorSurat = document.getElementById('inpNomorMasuk').value;
        payload.asal = document.getElementById('inpPengirim').value;
        payload.diteruskan = document.getElementById('inpDiteruskan').value; 
        
        if (!payload.nomorSurat) emptyFields.push("Nomor Surat");
        if (!payload.asal) emptyFields.push("Asal / Pengirim");

    } else {
        // --- SURAT KELUAR ---
        const k = document.getElementById('inpKode').value;
        const n = document.getElementById('inpNoUrut').value;
        const kl = document.getElementById('inpKodeLanjutan').value;
        const t = document.getElementById('inpTahun').value;
        
        payload.kodeKlasifikasi = k;
        payload.noUrut = n;
        payload.noLengkap = `${k}/${n}/${kl}/${t}`; 
        payload.tujuan = document.getElementById('inpTujuan').value;
        payload.asalNaskah = document.getElementById('inpAsalNaskah').value;

        if (!k) emptyFields.push("Kode Klasifikasi");
        if (!n) emptyFields.push("Nomor Urut");
        if (!payload.tujuan) emptyFields.push("Tujuan / Penerima");
        if (!payload.asalNaskah) emptyFields.push("Asal Naskah");
    }

    // 4. CEK APAKAH ADA YANG KOSONG?
    if (emptyFields.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Data Belum Lengkap',
            html: `Mohon lengkapi field berikut:<br/><b>${emptyFields.join(', ')}</b>`
        });
        return; 
    }

    // --- LOGIKA BARU DI SINI ---
    
    // 4.5. KHUSUS SURAT KELUAR & KEPUTUSAN: CEK DUPLIKASI NOMOR URUT
    if (kategori === 'surat_keluar' || kategori === 'surat_keputusan') { 
        if (payload.noUrut) {
            payload.noUrut = String(parseInt(payload.noUrut)).padStart(3, '0');
            const k = document.getElementById('inpKode').value;
            const kl = document.getElementById('inpKodeLanjutan').value;
            const t = document.getElementById('inpTahun').value;
            payload.noLengkap = `${k}/${payload.noUrut}/${kl}/${t}`;
        }

        const inputNoUrut = payload.noUrut; 
        const inputTahun = document.getElementById('inpTahun').value;
        const currentRow = document.getElementById('realRowNumber').value;

        // PILIH DATABASE BERDASARKAN KATEGORI YANG SEDANG DIINPUT
        const targetDb = kategori === 'surat_keputusan' ? globalData.suratKeputusan : globalData.suratKeluar;

        const isDuplicate = targetDb.some(item => {
            if (isEdit && String(item.rowNumber) === String(currentRow)) return false;
            
            const dbNoUrut = parseInt(item.values[4]) || 0; 
            const dbNoLengkap = String(item.values[5]); 
            const inpNoInt = parseInt(inputNoUrut) || 0; 

            return (dbNoUrut === inpNoInt && dbNoLengkap.includes(inputTahun));
        });

        if (isDuplicate) {
            Swal.fire({
                title: 'Gagal Simpan!',
                html: `Nomor urut <b>${inputNoUrut}</b> sudah terdaftar di tahun <b>${inputTahun}</b>.<br>Silakan gunakan nomor lain.`,
                icon: 'error',
                confirmButtonColor: '#d33',
                confirmButtonText: 'Tutup & Perbaiki'
            });
            return; 
        }
    }

    // Jika tidak ada duplikasi, langsung eksekusi simpan
    executeSimpan(fileInput, payload);
}

// FUNGSI PEMBANTU: EKSEKUSI SIMPAN / UPLOAD FINAL
function executeSimpan(fileInput, payload) {
    showLoading(true);
    // Tutup modal jika masih terbuka
    const modalEl = document.getElementById('modalSurat');
    let modalInstance = null;
    if(modalEl) modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();

    // 5. PROSES UPLOAD & KIRIM (Logic dipindah ke sini)
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        // Validasi Ukuran File (Max 2MB)
        if (file.size > 2 * 1024 * 1024) { 
            Swal.fire('Error', 'Ukuran file terlalu besar (lebih dari 2 MB). Silakan dikompres terlebih dahulu.', 'error');
            showLoading(false); 
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            payload.fileName = file.name;
            payload.fileMime = file.type;
            payload.fileData = e.target.result.split(',')[1];
            kirimKeGAS(payload);
        };
        reader.readAsDataURL(file);
    } else {
        kirimKeGAS(payload);
    }
}

function kirimKeGAS(payload) {
    fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(resp => {
        // Biarkan logika ini (loading mati kecuali hapusSurat, karena hapusSurat lanjut ke loadData)
        if(payload.action !== 'hapusSurat') showLoading(false); 
        
        if (resp.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: resp.message,
                timer: 2000,
                showConfirmButton: false
            });
            loadData(); // loadData akan mematikan loading secara otomatis setelah selesai refresh
        } else {
            // --- UPDATE BAGIAN INI ---
            if(payload.action === 'hapusSurat') {
                showLoading(false); // Pastikan loading mati jika Gagal Hapus (misal password salah)
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: resp.message
                });
            } else {
                showLoading(false);
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: resp.message
                });
            }
            // -------------------------
        }
    })
    .catch(err => {
        showLoading(false);
        Swal.fire('Error', "Error Network: " + err, 'error');
    });
}

// === FUNGSI DOWNLOAD ===
function openDownloadModal(kategori) {
    document.getElementById('downloadKategori').value = kategori;
    document.getElementById('dlStartDate').value = "";
    document.getElementById('dlEndDate').value = "";
    if(dlModal) dlModal.show();
}

function processDownload() {
    const start = document.getElementById('dlStartDate').value;
    const end = document.getElementById('dlEndDate').value;
    const kategori = document.getElementById('downloadKategori').value;
    const format = document.getElementById('dlFormat').value; // Ambil nilai format

    if (!start || !end) {
        Swal.fire('Info', 'Mohon lengkapi Tanggal Awal dan Akhir', 'info');
        return;
    }

    showLoading(true);
    if(dlModal) dlModal.hide();

    const payload = {
        action: 'downloadRekap',
        kategori: kategori,
        startDate: start,
        endDate: end,
        format: format // Kirim format ke backend
    };

    fetch(GAS_API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(resp => {
        showLoading(false);
        if (resp.status === 'success') {
            
            if (resp.format === 'pdf') {
                // --- HANDLE PDF ---
                // Buat link download virtual dari data Base64
                const link = document.createElement('a');
                link.href = 'data:application/pdf;base64,' + resp.fileData;
                link.download = resp.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                Swal.fire({ 
                    icon: 'success', 
                    title: 'Berhasil', 
                    text: 'Laporan PDF berhasil diunduh.', 
                    timer: 2000, 
                    showConfirmButton: false 
                });

            } else {
                // --- HANDLE EXCEL ---
                generateExcel(resp.data, resp.fileName, kategori);
                Swal.fire({ 
                    icon: 'success', 
                    title: 'Berhasil', 
                    text: 'File Excel telah diunduh.', 
                    timer: 2000, 
                    showConfirmButton: false 
                });
            }

        } else {
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: resp.message
            });
        }
    })
    .catch(err => {
        showLoading(false);
        Swal.fire('Error', "Gagal mengunduh: " + err, 'error');
    });
}

function generateExcel(jsonData, fileName, kategori) {
    const worksheet = XLSX.utils.json_to_sheet(jsonData);
    
    let wscols = [];
    let sheetName = "";

    if (kategori === 'perjadin') {
        // Lebar kolom khusus Perjadin
        wscols = [
            {wch: 5},  // No
            {wch: 15}, // Tgl Mulai
            {wch: 15}, // Tgl Selesai
            {wch: 18}, // Jenis
            {wch: 40}, // Maksud / Kegiatan
            {wch: 25}, // Tempat
            {wch: 20}, // Daerah
            {wch: 30}, // No TS
            {wch: 30}, // No SPT
            {wch: 50}, // Pelaksana (Lebar karena bisa banyak nama)
            {wch: 20}, // Asal Naskah
            {wch: 30}  // Keterangan
        ];
        sheetName = 'Rekap Perjadin';
    } else {
        // Lebar kolom standar Surat Masuk/Keluar
        wscols = [
            {wch: 5}, {wch: 15}, {wch: 25}, {wch: 20}, 
            {wch: 30}, {wch: 40}, {wch: 30}, {wch: 15}
        ];
        sheetName = kategori === 'surat_masuk' ? 'Surat Masuk' : 'Surat Keluar';
    }

    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    XLSX.writeFile(workbook, fileName);
}

function showLoading(show) {
    const el = document.getElementById('loading');
    if(!el) return;
    if (show) el.classList.remove('d-none');
    else el.classList.add('d-none');
}

function logout() {
    Swal.fire({
        title: 'Konfirmasi',
        text: "Anda yakin ingin keluar dari aplikasi?",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal',
        reverseButtons: true 
    }).then((result) => {
        if (result.isConfirmed) {
            currentUser = null;
            
            // --- TAMBAHAN FIX: SEMBUNYIKAN FAB SAAT LOGOUT ---
            document.getElementById('fabTambah').style.display = 'none'; 
            // -------------------------------------------------

            document.getElementById('appPanel').classList.add('d-none');
            document.getElementById('loginPanel').classList.remove('d-none');
            document.getElementById('formLogin').reset();
        }
    });
}

// === LOGIKA PREVIEW FILE ===
const modalPreviewElement = document.getElementById('modalPreview');
let myPreviewModal;
if (modalPreviewElement) {
    myPreviewModal = new bootstrap.Modal(modalPreviewElement);
    // Bersihkan iframe saat modal ditutup
    modalPreviewElement.addEventListener('hidden.bs.modal', function () {
        document.getElementById('framePreview').src = "";
    });		
}

function previewFile(url) {
    if (!url) return;

    // Trik: Ubah '/view' menjadi '/preview' agar embed Google Drive lebih rapi (tanpa toolbar atas)
    let embedUrl = url;
    if (url.includes('drive.google.com') && url.includes('/view')) {
        embedUrl = url.replace('/view', '/preview');
    }

    // Set URL ke iframe
    document.getElementById('framePreview').src = embedUrl;
    
    // Baris pengaturan tombol download dihapus karena tombolnya sudah tidak ada
    
    if(myPreviewModal) myPreviewModal.show();
}
    
function handleFabClick() {
    if (!document.getElementById('tab-suratMasuk').classList.contains('d-none')) {
        openModal('masuk');
    } else if (!document.getElementById('tab-suratKeluar').classList.contains('d-none')) {
        openModal('keluar');
    } else if (!document.getElementById('tab-suratKeputusan').classList.contains('d-none')) { // <--- TAMBAHKAN BLOK INI
        openModal('keputusan');
    } else if (!document.getElementById('tab-perjadin').classList.contains('d-none')) { 
        openModalPerjadin();
    } else if (!document.getElementById('tab-npd').classList.contains('d-none')) { 
        openModalNpd();
    }			
}

// === LOGIKA PERJADIN ===

function openModalPerjadin() {
    document.getElementById('formPerjadin').reset();
    resetDropZonePerjadin(); // Reset Drag & Drop UI

    // SET DEFAULT VALUES
    document.getElementById('pJenis').value = "";      
    document.getElementById('pAsalNaskah').value = "";
    
    // --- TAMBAHAN: Reset Tampilan Lainnya ---
    toggleAsalNaskahLainnya(); 
    //			
    
    document.getElementById('tsSuffix').value = "BKPSDM-BLG";
    document.getElementById('tsTahun').value = "2026";
    document.getElementById('sptSuffix').value = "BKPSDM-BLG"; 
    document.getElementById('sptTahun').value = "2026";            

    // Reset Preview & Validasi Visual
    updatePreviewPerjadin();
    document.getElementById('tsNo').classList.remove('is-invalid');
    document.getElementById('sptNo').classList.remove('is-invalid');
    
    document.getElementById('pIsEdit').value = "false";
    document.getElementById('pRowNumber').value = "";
    document.getElementById('personilContainer').innerHTML = ""; // Kosongkan personil
    document.getElementById('personilEmptyState').style.display = 'block';
    document.getElementById('modalPerjadinTitle').innerHTML = "<i class='fas fa-plane-departure me-2'></i>Input Perjalanan Dinas";
    
    // Default Values Form
    toggleTanggalSelesai();
    
    // Buka Modal
    const modalPerjadinElement = document.getElementById('modalPerjadin');
    if(modalPerjadinElement) new bootstrap.Modal(modalPerjadinElement).show();
}

function toggleTanggalSelesai() {
    const jenis = document.getElementById('pJenis').value;
    const divSelesai = document.getElementById('divTglSelesai');
    if (jenis === 'Dalam Daerah') {
        divSelesai.style.display = 'none';
        document.getElementById('pTglSelesai').removeAttribute('required');
    } else {
        divSelesai.style.display = 'block';
        document.getElementById('pTglSelesai').setAttribute('required', '');
    }
}

// --- HELPER: AUTO FORMAT 3 DIGIT (MENDUKUNG RANGE) ---
function formatAutoPad(input) {
    // KHUSUS SPPD: Izinkan tanda strip (-) untuk nomor "Terlampir" (contoh: 005-020)
    if (input.classList.contains('inp-sppd') && input.value.includes('-')) {
        const parts = input.value.split('-');
        const val1 = parseInt(parts[0].replace(/\D/g, ''));
        const val2 = parseInt(parts[1].replace(/\D/g, ''));
        
        if (!isNaN(val1) && !isNaN(val2)) {
            input.value = String(val1).padStart(3, '0') + '-' + String(val2).padStart(3, '0');
        }
        return; // Berhenti di sini untuk format range
    }

    // --- Logika Standar (TS / SPT / SPPD Tunggal) ---
    const rawVal = input.value.replace(/\D/g, ''); 
    
    if (rawVal !== "") {
        const valNum = parseInt(rawVal);
        input.value = String(valNum).padStart(3, '0');
    } else {
        input.value = ""; // Pastikan bisa dikosongkan jika belum ada nomor
    }

    // Update Preview
    if (input.id === 'inpNoUrut' && typeof updatePreviewNomor === "function") updatePreviewNomor();
    else if (input.id === 'nNoUrut' && typeof updatePreviewNpd === "function") updatePreviewNpd(); // <--- TAMBAHAN UNTUK NPD
    else if (typeof updatePreviewPerjadin === "function") updatePreviewPerjadin();
}

function toggleAsalNaskahLainnya() {
    const dropdown = document.getElementById('pAsalNaskah');
    const inputLain = document.getElementById('pAsalNaskahLainnya');
    
    if (dropdown.value === 'Lainnya') {
        inputLain.style.display = 'block';
        inputLain.setAttribute('required', ''); // Wajib diisi jika Lainnya
        inputLain.focus();
    } else {
        inputLain.style.display = 'none';
        inputLain.removeAttribute('required');
        inputLain.value = ""; // Reset isinya
    }
}

// --- REPEATER PERSONIL & AUTOCOMPLETE ---
let personilCount = 0;

function addPersonilRow(data = null) {
    document.getElementById('personilEmptyState').style.display = 'none';
    personilCount++;
    
    const container = document.getElementById('personilContainer');
    const rowId = `pRow_${personilCount}`;
    
    // Tentukan No SPPD Otomatis
    let defaultNo = "";
    let defaultNama = "";
    let defaultNip = "";

    if (data) {
        defaultNo = data.no;
        defaultNama = data.nama;
        defaultNip = data.nip;
    } else {
        // Logic Auto Number Sederhana
        const inputs = container.querySelectorAll('.inp-sppd');
        if(inputs.length > 0) {
            const lastNo = inputs[inputs.length - 1].value;
            if(!isNaN(lastNo) && lastNo !== "") {
                defaultNo = String(parseInt(lastNo) + 1).padStart(3, '0');
            }
        }
    }

    const div = document.createElement('div');
    div.className = 'personil-row';
    div.id = rowId;
    div.innerHTML = `
        <input type="text" class="form-control form-control-sm inp-sppd" 
               placeholder="000" value="${defaultNo}" title="No SPPD"
               onblur="formatAutoPad(this)">
        
        <div class="position-relative inp-nama">
            <input type="text" class="form-control form-control-sm personil-search" 
                   list="listOpsiASN" 
                   placeholder="Ketik nama..." 
                   value="${defaultNama ? defaultNama + ' (' + defaultNip + ')' : ''}" 
                   oninput="handleInputASN(this, '${rowId}')" 
                   autocomplete="off">
            
            <input type="hidden" class="personil-nip" value="${defaultNip}">
        </div>

        <button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="removePersonilRow('${rowId}')">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removePersonilRow(id) {
    document.getElementById(id).remove();
    if(document.getElementById('personilContainer').children.length === 0) {
        document.getElementById('personilEmptyState').style.display = 'block';
    }
}

// --- SEARCH ENGINE ASN (VERSI DATALIST) ---
function handleInputASN(inputEl, rowId) {
    const query = inputEl.value.toLowerCase();
    const dataList = document.getElementById('listOpsiASN');
    
    // 1. UPDATE OPSI DATALIST (Hanya jika mengetik 3 huruf lebih)
    if (query.length >= 3) {
        const results = globalASN.filter(asn => 
            asn.nama.toLowerCase().includes(query)
        ).slice(0, 20);

        dataList.innerHTML = ''; 
        results.forEach(asn => {
            const opt = document.createElement('option');
            opt.value = `${asn.nama} (${asn.nip})`; 
            dataList.appendChild(opt);
        });
    }

    // 2. DETEKSI PILIHAN USER (AUTO-FILL NIP)
    const match = inputEl.value.match(/\(([^)]+)\)$/);
    const nipInput = document.querySelector(`#${rowId} .personil-nip`);

    if (match) {
        const extractedNip = match[1]; 
        nipInput.value = extractedNip;
    } else {
        nipInput.value = ""; 
    }
}

// Tutup search box (Legacy safety)
document.addEventListener('click', function(e) {
    if (!e.target.classList.contains('personil-search')) {
        document.querySelectorAll('.search-result-box').forEach(el => el.style.display = 'none');
    }
});

// --- SIMPAN / EDIT PERJADIN (VERSI FINAL: VALIDASI CERDAS & BACKWARD COMPATIBLE) ---
function simpanPerjadin() {
    // 1. AMBIL DATA FORM
    const pJenis = document.getElementById('pJenis').value;
    const pTglMulai = document.getElementById('pTglMulai').value;
    let pTglSelesai = document.getElementById('pTglSelesai').value;
    if (pJenis === 'Dalam Daerah') pTglSelesai = pTglMulai;

    const pMaksud = document.getElementById('pMaksud').value;
    const pTempat = document.getElementById('pTempat').value;
    const pDaerah = document.getElementById('pDaerah').value;
    
    let valAsalNaskah = document.getElementById('pAsalNaskah').value;
    if (valAsalNaskah === 'Lainnya') valAsalNaskah = document.getElementById('pAsalNaskahLainnya').value;

    // 2. VALIDASI FIELD WAJIB
    let emptyFields = [];
    if (!pJenis) emptyFields.push("Jenis Perjadin");
    if (!valAsalNaskah) emptyFields.push("Asal Naskah"); 
    if (!pTempat) emptyFields.push("Tempat/Tujuan");
    if (!pDaerah) emptyFields.push("Kota/Kabupaten");
    if (!pTglMulai) emptyFields.push("Tanggal Mulai");
    if (!pMaksud) emptyFields.push("Maksud/Kegiatan");
    if (pJenis !== 'Dalam Daerah' && !pTglSelesai) emptyFields.push("Tanggal Selesai");

    if (emptyFields.length > 0) {
        Swal.fire({icon: 'warning', title: 'Data Belum Lengkap', html: `Mohon lengkapi:<br/><b>${emptyFields.join(', ')}</b>`});
        return;
    }

    // 3. SIAPKAN KOMPONEN NOMOR
    const tsKode = document.getElementById('tsKode').value;
    const tsNo = document.getElementById('tsNo').value;
    const tsSuffix = document.getElementById('tsSuffix').value;
    const tsTahun = document.getElementById('tsTahun').value;
    const tsFull = `${tsKode}/${tsNo}/${tsSuffix}/${tsTahun}`;

    const sptKode = document.getElementById('sptKode').value;
    const sptNo = document.getElementById('sptNo').value;
    const sptSuffix = document.getElementById('sptSuffix').value;
    const sptTahun = document.getElementById('sptTahun').value;
    const sptFull = `${sptKode}/${sptNo}/${sptSuffix}/${sptTahun}`;

    // 4. AMBIL PERSONIL (Dukung Range)
    const rows = document.querySelectorAll('.personil-row');
    if (rows.length === 0) {
        Swal.fire('Error', 'Minimal 1 pelaksana!', 'warning');
        return;
    }
    let personilList = [];
    rows.forEach(row => {
        let no = row.querySelector('.inp-sppd').value;
        const rawNama = row.querySelector('.personil-search').value;
        const nip = row.querySelector('.personil-nip').value;
        
        // Format ulang saat mau disimpan agar konsisten
        if(no) {
            if(no.includes('-')) {
                const parts = no.split('-');
                no = String(parseInt(parts[0]) || 0).padStart(3, '0') + '-' + String(parseInt(parts[1]) || 0).padStart(3, '0');
            } else {
                no = String(parseInt(no) || 0).padStart(3, '0');
            }
        }

        let namaClean = rawNama.includes('(') ? rawNama.split('(')[0].trim() : rawNama;
        if(namaClean) personilList.push({ no, nama: namaClean, nip });
    });

    // ============================================================
    // 5. CEK DUPLIKASI CERDAS (Mengabaikan yang Kosong & Baca Range)
    // ============================================================
    const isEdit = document.getElementById('pIsEdit').value === "true";
    const currentRow = document.getElementById('pRowNumber').value;
    let duplicateMsg = [];
    const toInt = (val) => parseInt(val) || 0;

    // Helper untuk mengurai "005-008" menjadi array [5, 6, 7, 8]
    const expandSppd = (sppdStr) => {
        if (!sppdStr) return [];
        if (sppdStr.includes('-')) {
            const parts = sppdStr.split('-');
            const start = Math.min(toInt(parts[0]), toInt(parts[1]));
            const end = Math.max(toInt(parts[0]), toInt(parts[1]));
            let res = [];
            for (let i = start; i <= end; i++) res.push(i);
            return res;
        }
        return [toInt(sppdStr)];
    };

    globalData.perjadin.forEach(item => {
        if (isEdit && String(item.rowNumber) === String(currentRow)) return;
        const vals = item.values;
        
        // --- A. CEK NOMOR TS (Hanya jika diinput) ---
        if (tsNo !== "") {
            const dbTsNo = vals[9];       
            const dbTsFull = vals[10] || ""; 
            if (dbTsNo && toInt(dbTsNo) === toInt(tsNo) && dbTsFull.includes(tsTahun)) {
                duplicateMsg.push(`Nomor TS <b>${tsNo}</b> (Tahun ${tsTahun})`);
            } else if (!dbTsNo && dbTsFull) {
                const parts = dbTsFull.split('/'); 
                if (parts.length >= 4 && toInt(parts[1]) === toInt(tsNo) && parts[3] == tsTahun) {
                    duplicateMsg.push(`Nomor TS <b>${tsNo}</b> (Tahun ${tsTahun})`);
                }
            }
        }

        // --- B. CEK NOMOR SPT (Hanya jika diinput) ---
        if (sptNo !== "") {
            const dbSptNo = vals[12];        
            const dbSptFull = vals[13] || ""; 
            if (dbSptNo && toInt(dbSptNo) === toInt(sptNo) && dbSptFull.includes(sptTahun)) {
                duplicateMsg.push(`Nomor SPT <b>${sptNo}</b> (Tahun ${sptTahun})`);
            } else if (!dbSptNo && dbSptFull) {
                const parts = dbSptFull.split('/');
                if (parts.length >= 4 && toInt(parts[1]) === toInt(sptNo) && parts[3] == sptTahun) {
                    duplicateMsg.push(`Nomor SPT <b>${sptNo}</b> (Tahun ${sptTahun})`);
                }
            }
        }

        // --- C. CEK NOMOR SPPD (Mendukung Irisan Range) ---
        try {
            const dbPersonils = JSON.parse(vals[16]);
            
            // PERBAIKAN: Deteksi Tahun yang Lebih Cerdas (Karena SPT/TS bisa kosong)
            let dbYear = "";
            if (vals[13]) { // Coba dari string Nomor SPT Lengkap
                const parts = vals[13].split('/');
                if (parts.length >= 4) dbYear = parts[3];
            }
            if (!dbYear && vals[10]) { // Coba dari string Nomor TS Lengkap
                const parts = vals[10].split('/');
                if (parts.length >= 4) dbYear = parts[3];
            }
            if (!dbYear && vals[3]) { // Fallback: Ambil dari Tanggal Mulai Perjadin
                dbYear = new Date(vals[3]).getFullYear().toString();
            }

            // Tahun target dari input form
            const targetYear = sptTahun || tsTahun || new Date().getFullYear().toString();

            if (dbYear === targetYear) { 
                dbPersonils.forEach(dbP => {
                    if (!dbP.no) return; // Lewati jika SPPD di database kosong
                    const dbSppdArr = expandSppd(dbP.no);
                    
                    personilList.forEach(inputP => {
                        if (inputP.no !== "") { // Lewati jika SPPD yang diketik kosong
                            const inputSppdArr = expandSppd(inputP.no);
                            // Cek tabrakan angka
                            const isOverlap = inputSppdArr.some(num => dbSppdArr.includes(num));
                            
                            if (isOverlap) {
                                const msg = `Nomor SPPD <b>${inputP.no}</b> bertabrakan dengan data terdaftar (Tahun ${targetYear})`;
                                if (!duplicateMsg.includes(msg)) duplicateMsg.push(msg);
                            }
                        }
                    });
                });
            }
        } catch(e) {
            console.log("Error parse personil:", e);
        }
    });

    // JIKA ADA DUPLIKAT -> TOLAK KERAS
    if (duplicateMsg.length > 0) {
        Swal.fire({
            title: 'Gagal Simpan!',
            html: `Nomor urut berikut sudah terdaftar/bertabrakan:<br>
                   <ul class="text-start mt-3 mb-3 text-danger fw-bold small" style="list-style-position: inside;">
                       <li>${duplicateMsg.join('</li><li>')}</li>
                   </ul>
                   Silakan kosongkan nomor jika belum ada, atau gunakan nomor lain.`,
            icon: 'error',
            confirmButtonColor: '#d33',
            confirmButtonText: 'Tutup & Perbaiki'
        });
        return; 
    }

    // 6. KIRIM KE SERVER (Jika kosong, pastikan tidak menyimpan format "800//BKPSDM...")
    const fmtNo = (n) => n ? String(parseInt(n)).padStart(3, '0') : "";
    
    const finalTsNo = fmtNo(tsNo);
    const finalSptNo = fmtNo(sptNo);
    
    const finalTsFull = finalTsNo ? `${tsKode}/${finalTsNo}/${tsSuffix}/${tsTahun}` : "";
    const finalSptFull = finalSptNo ? `${sptKode}/${finalSptNo}/${sptSuffix}/${sptTahun}` : "";

    const payload = {
        action: isEdit ? 'updatePerjadin' : 'simpanPerjadin',
        rowNumber: currentRow,
        jenisPerjadin: pJenis,
        tglMulai: pTglMulai,
        tglSelesai: pTglSelesai,
        maksud: pMaksud,
        tempat: pTempat,
        daerah: pDaerah,
        tsKode: tsKode,
        tsNo: finalTsNo,     
        noTS: finalTsFull,   
        sptKode: sptKode,
        sptNo: finalSptNo,   
        noSPT: finalSptFull, 
        asalNaskah: valAsalNaskah,
        keterangan: document.getElementById('pKeterangan').value,
        personilJson: JSON.stringify(personilList),
        existingFile: document.getElementById('pExistingFile').value,
        username: currentUser.username,
        fileName: "", fileData: ""
    };

    const fileInput = document.getElementById('pFile');
    const sendRequest = () => {
        showLoading(true);
        const modalPerjadinElement = document.getElementById('modalPerjadin');
        if(modalPerjadinElement) bootstrap.Modal.getInstance(modalPerjadinElement).hide();
        fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json()).then(resp => {
            showLoading(false);
            if(resp.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: resp.message,
                    timer: 2000,
                    showConfirmButton: false
                });
                loadData();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: resp.message
                });
            }
        });
    };

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 2*1024*1024) { Swal.fire('Error','File max 2MB','error'); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            payload.fileName = file.name;
            payload.fileData = e.target.result.split(',')[1];
            sendRequest();
        };
        reader.readAsDataURL(file);
    } else {
        sendRequest();
    }
}

function editPerjadin(rowNumber) {
    const dataObj = globalData.perjadin.find(item => item.rowNumber === rowNumber);
    if (!dataObj) return;
    const r = dataObj.values;

    // Index 18 = Username
    if (r[18] !== currentUser.username && currentUser.role !== 'Super Admin') {
        Swal.fire('Akses Ditolak', 'Hanya Pemilik dan Super Admin yang dapat mengedit data ini.', 'error');
        return;
    }

    openModalPerjadin();
    document.getElementById('pIsEdit').value = "true";
    document.getElementById('pRowNumber').value = rowNumber;
    document.getElementById('modalPerjadinTitle').innerHTML = "<i class='fas fa-pen me-2'></i>Edit Perjadin";
    
    // Helper: Format 3 Digit (1 -> 001)
    const padNo = (val) => val ? String(parseInt(val)).padStart(3, '0') : "";

    document.getElementById('pJenis').value = r[2];
    
    const fmtDate = (dStr) => { 
        if(!dStr) return "";
        const d = new Date(dStr); 
        const tzDate = new Date(d.toLocaleString("en-US", {timeZone: "Asia/Makassar"}));
        return `${tzDate.getFullYear()}-${String(tzDate.getMonth()+1).padStart(2,'0')}-${String(tzDate.getDate()).padStart(2,'0')}`; 
    };
    
    document.getElementById('pTglMulai').value = fmtDate(r[3]);
    document.getElementById('pTglSelesai').value = fmtDate(r[4]);
    toggleTanggalSelesai();

    document.getElementById('pMaksud').value = r[5];
    document.getElementById('pTempat').value = r[6];
    document.getElementById('pDaerah').value = r[7];
    
    // --- POPULATE TS ---
    document.getElementById('tsKode').value = r[8];
    document.getElementById('tsNo').value = padNo(r[9]); // Auto Format 001
    
    const rawTS = r[10] || "";
    const partsTS = rawTS.split('/');
    if(partsTS.length >= 4) {
        document.getElementById('tsSuffix').value = partsTS[2];
        document.getElementById('tsTahun').value = partsTS[3];
    } else {
        document.getElementById('tsSuffix').value = "BKPSDM-BLG";
        document.getElementById('tsTahun').value = "2026";
    }

    // --- POPULATE SPT ---
    document.getElementById('sptKode').value = r[11];
    document.getElementById('sptNo').value = padNo(r[12]); // Auto Format 001
    
    const rawSPT = r[13] || "";
    const partsSPT = rawSPT.split('/');
    if(partsSPT.length >= 4) {
        document.getElementById('sptSuffix').value = partsSPT[2];
        document.getElementById('sptTahun').value = partsSPT[3];
    } else {
        document.getElementById('sptSuffix').value = "SPT/BKPSDM-BLG";
        document.getElementById('sptTahun').value = "2026";
    }
    
    updatePreviewPerjadin(); 
    
    // Asal Naskah
    const dbAsal = r[14]; 
    const standardOptions = ["Sekretariat", "Bidang PSDM", "Bidang PPIK", "Bidang MPK"];
    if (standardOptions.includes(dbAsal)) {
        document.getElementById('pAsalNaskah').value = dbAsal;
        toggleAsalNaskahLainnya();
    } else {
        document.getElementById('pAsalNaskah').value = "Lainnya";
        toggleAsalNaskahLainnya();
        document.getElementById('pAsalNaskahLainnya').value = dbAsal;
    }

    document.getElementById('pKeterangan').value = r[15];
    
    // File
    const fileUrl = r[17];
    document.getElementById('pExistingFile').value = fileUrl;
    const fileHelp = document.getElementById('fileHelpPerjadin');
    if (fileUrl) {
        fileHelp.innerHTML = `<span class="text-success fw-bold"><i class="fas fa-check-circle"></i> File tersimpan.</span> Upload baru untuk mengganti.`;
    } else {
        fileHelp.innerText = "Belum ada file. Upload untuk menambahkan.";
    }

    // Personil
    try {
        const pList = JSON.parse(r[16]);
        pList.forEach(p => {
            // Pastikan No SPPD mempertahankan format range (strip) jika ada
            if (p.no && p.no.includes('-')) {
                // Biarkan aslinya, jangan dimasukkan ke padNo agar teks setelah strip tidak hilang
                p.no = p.no; 
            } else {
                // Jika nomor tunggal, pastikan formatnya 3 digit
                p.no = padNo(p.no); 
            }
            addPersonilRow(p);
        });
    } catch(e) {}
}

// --- FUNGSI HAPUS KHUSUS PERJADIN ---
function hapusPerjadin(rowNumber) {
    // 1. Cari Data Dulu
    const dataObj = globalData.perjadin.find(item => item.rowNumber === rowNumber);
    if (!dataObj) return;
    const r = dataObj.values;

    // 2. Cek Kepemilikan (Index 14 adalah Username)
    // Sesuaikan index ini dengan urutan kolom di Code.gs simpanPerjadin
    const penginput = r[18]; 

    if (penginput !== currentUser.username && currentUser.role !== 'Super Admin') {
        Swal.fire({
            icon: 'error',
            title: 'Akses Ditolak',
            text: `Hanya Pemilik dan Super Admin yang dapat menghapus data ini.`,
        });
        return;
    }

    // 3. Konfirmasi Hapus
    Swal.fire({
        title: 'Hapus Perjadin?',
        html: `Anda akan menghapus data perjalanan dinas ini.<br>Masukkan Password untuk konfirmasi:`,
        input: 'password',
        inputAttributes: {
            autocomplete: 'new-password',
            autocapitalize: 'off'
        },
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal',
        reverseButtons: true,
        preConfirm: (pass) => {
            if (!pass) Swal.showValidationMessage('Password wajib diisi!');
            return pass;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true);
            
            // 4. Kirim ke Backend (Action: hapusPerjadin)
            fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'hapusPerjadin',
                    rowNumber: rowNumber,
                    username: currentUser.username,
                    password: result.value
                })
            })
            .then(res => res.json())
            .then(resp => {
                showLoading(false);
                if(resp.status === 'success') {
                    // PENGAMAN TAMBAHAN: Kosongkan pencarian Perjadin
                    document.getElementById('searchPerjadin').value = "";
                    resetPagination('perjadin');

                    Swal.fire('Terhapus', resp.message, 'success');
                    loadData();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal',
                        text: resp.message
                    });
                }
            });
        }
    });
}

// === LOGIKA NPD (NOTA PENCAIRAN DANA) ===

function openModalNpd() {
    document.getElementById('formNpd').reset();
    resetDropZoneNpd();

    // Set Default
    document.getElementById('nTahun').value = "2026";
    document.getElementById('nKodeTengah').value = "NPD/BKPSDM-BLG";
    
    document.getElementById('nIsEdit').value = "false";
    document.getElementById('nRowNumber').value = "";
    document.getElementById('modalNpdTitle').innerHTML = "<i class='fas fa-file-invoice-dollar me-2'></i>Input Nota Pencairan Dana (NPD)";
    
    updatePreviewNpd();
    const modalNpdElement = document.getElementById('modalNpd');
    if(modalNpdElement) new bootstrap.Modal(modalNpdElement).show();
}

function updatePreviewNpd() {
    const no = document.getElementById('nNoUrut').value;
    const kode = document.getElementById('nKodeTengah').value;
    const tahun = document.getElementById('nTahun').value;
    
    const preview = document.getElementById('previewNpd');
    if(no) {
        preview.innerText = `${no}/${kode}/${tahun}`;
    } else {
        preview.innerText = `-`;
    }
}

function toggleAsalNaskahNpd() {
    const dropdown = document.getElementById('nAsalNaskah');
    const inputLain = document.getElementById('nAsalNaskahLainnya');
    
    if (dropdown.value === 'Lainnya') {
        inputLain.style.display = 'block';
        inputLain.setAttribute('required', '');
        inputLain.focus();
    } else {
        inputLain.style.display = 'none';
        inputLain.removeAttribute('required');
        inputLain.value = ""; 
    }
}

// --- DRAG & DROP KHUSUS NPD ---
function setupDragAndDropNpd() {
    const dropZone = document.getElementById('dropZoneNpd');
    const fileInput = document.getElementById('nFile'); 
    
    if(!dropZone || !fileInput) return; // Safety check

    dropZone.addEventListener('click', () => fileInput.click());
    
    const validateFileSize = (file) => {
        if (file.size > 2 * 1024 * 1024) {
            Swal.fire({ icon: 'error', title: 'Gagal Upload', text: 'Ukuran file max 2 MB.' });
            fileInput.value = "";
            resetDropZoneNpd();
            return false;
        }
        return true;
    };

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            if (validateFileSize(fileInput.files[0])) updateUI(fileInput.files[0].name);
        }
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });
    ['dragenter', 'dragover'].forEach(evt => dropZone.classList.add('dragover'));
    ['dragleave', 'drop'].forEach(evt => dropZone.classList.remove('dragover'));

    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (validateFileSize(file)) {
                fileInput.files = e.dataTransfer.files;
                updateUI(file.name);
            }
        }
    });

    function updateUI(name) {
        document.getElementById('dropZoneTextNpd').style.display = 'none';
        document.getElementById('fileInfoNpd').style.display = 'flex';
        document.getElementById('fileNameNpd').innerText = name;
    }
}

function resetDropZoneNpd() {
    document.getElementById('dropZoneTextNpd').style.display = 'block';
    document.getElementById('fileInfoNpd').style.display = 'none';
    document.getElementById('nFile').value = "";
    document.getElementById('fileHelpNpd').innerText = "";
}

// ==========================================
// --- CRUD NOTA PENCAIRAN DANA (NPD) ---
// ==========================================

function simpanNpd() {
    const tglNaskah = document.getElementById('nTglNaskah').value;
    let noUrut = document.getElementById('nNoUrut').value; // Menggunakan let agar bisa diformat
    const kodeTengah = document.getElementById('nKodeTengah').value;
    const tahun = document.getElementById('nTahun').value;
    const asalNaskah = document.getElementById('nAsalNaskah').value;   
    const keperluan = document.getElementById('nKeperluan').value;

    // Validasi Field Wajib
    let emptyFields = [];
    if (!tglNaskah) emptyFields.push("Tanggal Naskah");
    if (!noUrut) emptyFields.push("No Urut");
    if (!tahun) emptyFields.push("Tahun");
    if (!asalNaskah) emptyFields.push("Asal Naskah");
    if (!keperluan) emptyFields.push("Deskripsi Belanja");

    if (emptyFields.length > 0) {
        Swal.fire({icon: 'warning', title: 'Data Belum Lengkap', html: `Lengkapi:<br><b>${emptyFields.join(', ')}</b>`});
        return;
    }

    // --- LOGIKA AUTO-PAD & CEK DUPLIKASI BARU ---
    // Format angka secara paksa jika user melewatkan onblur
    noUrut = String(parseInt(noUrut) || 0).padStart(3, '0');
    document.getElementById('nNoUrut').value = noUrut; // update ke layar UI
    
    const noLengkap = `${noUrut}/${kodeTengah}/${tahun}`;
    const isEdit = document.getElementById('nIsEdit').value === "true";
    const currentRow = document.getElementById('nRowNumber').value;
    
    const inputNoInt = parseInt(noUrut) || 0; // Ubah jadi angka murni untuk perbandingan

    // Cek Duplikasi Cerdas (1 = 01 = 001)
    const isDuplicate = globalData.npd.some(item => {
        if (isEdit && String(item.rowNumber) === String(currentRow)) return false;
        
        const dbNoUrutInt = parseInt(item.values[3]) || 0; // Kolom No Urut (Index 3)
        const dbNoLengkap = String(item.values[4] || "");  // Kolom No Lengkap (Index 4)

        // Tolak jika angkanya sama persis DAN berada di tahun yang sama
        return (dbNoUrutInt === inputNoInt && dbNoLengkap.includes(tahun));
    });

    if (isDuplicate) {
        Swal.fire({
            title: 'Gagal Simpan!', 
            html: `Nomor Urut <b>${inputNoInt}</b> sudah terdaftar di tahun <b>${tahun}</b>.<br>Silakan gunakan nomor urut lain.`, 
            icon: 'error',
            confirmButtonColor: '#d33'
        });
        return;
    }
    // ---------------------------------------------

    const payload = {
        action: isEdit ? 'updateNpd' : 'simpanNpd',
        rowNumber: currentRow,
        tanggalNaskah: tglNaskah,
        noUrut: noUrut,
        noNpdLengkap: noLengkap,
        asalNaskah: asalNaskah,
        keperluan: keperluan,
        existingFile: document.getElementById('nExistingFile').value,
        username: currentUser.username,
        fileName: "", fileData: ""
    };

    const fileInput = document.getElementById('nFile');
    
    const sendRequest = () => {
        showLoading(true);
        const modalNpdElement = document.getElementById('modalNpd');
        if(modalNpdElement) bootstrap.Modal.getInstance(modalNpdElement).hide();
        fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify(payload) })
        .then(res => res.json()).then(resp => {
            showLoading(false);
            if(resp.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: resp.message,
                    timer: 2000,
                    showConfirmButton: false
                });
                loadData();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: resp.message
                });
            }
        });
    };

    // Proses Upload File jika ada
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 2*1024*1024) { Swal.fire('Error','File max 2MB','error'); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            payload.fileName = file.name;
            payload.fileData = e.target.result.split(',')[1];
            sendRequest();
        };
        reader.readAsDataURL(file);
    } else {
        sendRequest();
    }
}

function editNpd(rowNumber) {
    const dataObj = globalData.npd.find(item => item.rowNumber === rowNumber);
    if (!dataObj) return;
    const r = dataObj.values;

    // Cek Kepemilikan (Username di index 8)
    if (r[8] !== currentUser.username && currentUser.role !== 'Super Admin') {
        Swal.fire('Akses Ditolak', 'Hanya Pemilik dan Super Admin yang dapat mengedit data ini.', 'error');
        return;
    }

    openModalNpd();
    document.getElementById('nIsEdit').value = "true";
    document.getElementById('nRowNumber').value = rowNumber;
    document.getElementById('modalNpdTitle').innerHTML = "<i class='fas fa-pen me-2'></i>Edit NPD";

    // Set Form Data (Force Zona Waktu ke WITA agar tidak mundur sehari)
    const d = new Date(r[2]);
    const tzDate = new Date(d.toLocaleString("en-US", {timeZone: "Asia/Makassar"}));
    document.getElementById('nTglNaskah').value = `${tzDate.getFullYear()}-${String(tzDate.getMonth()+1).padStart(2,'0')}-${String(tzDate.getDate()).padStart(2,'0')}`;
    
    const padNo = (val) => val ? String(parseInt(val)).padStart(3, '0') : "";
    
    // Ekstrak Tahun dari Nomor Lengkap
    const parts = (r[4] || "").split('/');
    if(parts.length >= 3) {
        document.getElementById('nTahun').value = parts[parts.length-1];
    }

    document.getElementById('nAsalNaskah').value = r[5];

    document.getElementById('nKeperluan').value = r[6];
    document.getElementById('nExistingFile').value = r[7];
    
    if (r[7]) {
        document.getElementById('fileHelpNpd').innerHTML = `<span class="text-success fw-bold"><i class="fas fa-check-circle"></i> File tersimpan.</span> Upload baru untuk mengganti.`;
    } else {
        document.getElementById('fileHelpNpd').innerText = "Belum ada file. Upload untuk menambahkan.";
    }

    updatePreviewNpd();
}

function hapusNpd(rowNumber) {
    const dataObj = globalData.npd.find(item => item.rowNumber === rowNumber);
    if (!dataObj) return;

    if (dataObj.values[8] !== currentUser.username && currentUser.role !== 'Super Admin') {
        Swal.fire('Akses Ditolak', 'Hanya Pemilik dan Super Admin yang dapat menghapus data ini.', 'error');
        return;
    }

    Swal.fire({
        title: 'Hapus NPD?',
        html: `Masukkan Password Anda untuk konfirmasi penghapusan:`,
        input: 'password',
        inputAttributes: { autocomplete: 'new-password', autocapitalize: 'off' },
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal',
        reverseButtons: true,
        preConfirm: (pass) => {
            if (!pass) Swal.showValidationMessage('Password wajib diisi!');
            return pass;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true);
            fetch(GAS_API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'hapusNpd', rowNumber: rowNumber, username: currentUser.username, password: result.value })
            }).then(res => res.json()).then(resp => {
                showLoading(false);
                if(resp.status === 'success') {
                    document.getElementById('searchNpd').value = "";
                    resetPagination('npd');
                    Swal.fire('Terhapus', resp.message, 'success');
                    loadData(); // Refresh Data
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal',
                        text: resp.message
                    });
                }
            });
        }
    });
}

// ========================================================
// --- LOGIKA MODAL KODE KLASIFIKASI (3000 DATA OPTIMIZED) ---
// ========================================================

const modalKlasElement = document.getElementById('modalKlasifikasi');
let myModalKlasifikasi;
if (modalKlasElement) myModalKlasifikasi = new bootstrap.Modal(modalKlasElement);

// Debounce Timer untuk mencegah lag saat mengetik cepat
let typingTimerKlasifikasi; 
const doneTypingInterval = 300; // Tunggu 0.3 detik setelah berhenti ngetik

function bukaModalKlasifikasi(targetId) {
    targetInputKlasifikasi = targetId; // Simpan ID input pemanggil (inpKode/tsKode/sptKode)
    document.getElementById('searchKlasifikasi').value = ""; // Bersihkan kolom pencarian
    
    // Buka Modal
    if(myModalKlasifikasi) myModalKlasifikasi.show();
    
    // Langsung tampilkan semua data saat pertama dibuka
    renderListKlasifikasi(globalData.kodeKlasifikasi);
    
    // Auto-focus ke kolom pencarian setelah animasi modal selesai
    setTimeout(() => {
        document.getElementById('searchKlasifikasi').focus();
    }, 500);
}

function cariKlasifikasi() {
    clearTimeout(typingTimerKlasifikasi);
    typingTimerKlasifikasi = setTimeout(eksekusiPencarianKlas, doneTypingInterval);
}

function eksekusiPencarianKlas() {
    const term = document.getElementById('searchKlasifikasi').value.toLowerCase().trim();
    const info = document.getElementById('klasifikasiInfo');
    
    if (term === "") {
        renderListKlasifikasi(globalData.kodeKlasifikasi);
        return;
    }

    // Filter array (Sangat cepat karena berjalan di memori client/browser)
    const filtered = globalData.kodeKlasifikasi.filter(item => 
        item.kode.toLowerCase().includes(term) || 
        item.keterangan.toLowerCase().includes(term)
    );

    renderListKlasifikasi(filtered, term);
}

function renderListKlasifikasi(data, highlightTerm = "") {
    const container = document.getElementById('listKlasifikasi');
    const info = document.getElementById('klasifikasiInfo');
    
    info.innerHTML = `Menampilkan <b>${data.length}</b> kode klasifikasi.`;
    
    if (data.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-search-minus fa-3x mb-3 opacity-25"></i>
                <p>Kode atau keterangan tidak ditemukan.</p>
            </div>
        `;
        return;
    }

    // Gunakan innerHTML mapping agar rendering ribuan DOM lebih cepat
    // Array map -> join("") akan merender 3000 data dalam hitungan milidetik
    let html = data.map(item => {
        let k = item.kode;
        let desc = item.keterangan;
        
        // Aturan Hierarki CSS
        let addClass = "klasifikasi-child";
        let badgeClass = "bg-light text-secondary border";
        let badgeStyle = "min-width: 75px; font-family: monospace;";

        // REGEX: Jika murni 3 digit angka (ex: 800, 000, 100)
        if (/^\d{3}$/.test(k)) {
            addClass = "klasifikasi-parent-1";
            badgeClass = "bg-primary text-white border-0";
        } 
        // REGEX: Jika 3 digit + Titik + 1 digit (ex: 800.1, 900.2)
        else if (/^\d{3}\.\d{1}$/.test(k)) {
            addClass = "klasifikasi-parent-2";
            badgeClass = "bg-secondary text-white border-0";
        }

        // Highlight teks yang dicari (Jika ada)
        if (highlightTerm !== "") {
            const regex = new RegExp(`(${highlightTerm})`, 'gi');
            desc = desc.replace(regex, `<mark class="bg-warning p-0">$1</mark>`);
            k = k.replace(regex, `<mark class="bg-warning p-0">$1</mark>`);
        }

        return `
            <div class="list-group-item list-group-item-action py-2 px-3 ${addClass} klasifikasi-item d-flex align-items-start gap-3" 
                 onclick="pilihKlasifikasi('${item.kode}')">
                <span class="badge ${badgeClass} fs-6 text-center shadow-sm" style="${badgeStyle}">${k}</span>
                <span class="flex-grow-1 lh-sm">${desc}</span>
            </div>
        `;
    }).join("");

    container.innerHTML = html;
}

function pilihKlasifikasi(kodeKlas) {
    const inputEl = document.getElementById(targetInputKlasifikasi);
    if(inputEl) {
        inputEl.value = kodeKlas; // Isi field
        
        // Pancing fungsi update preview nomor agar live-update di form
        if (targetInputKlasifikasi === 'inpKode' && typeof updatePreviewNomor === 'function') {
            updatePreviewNomor();
        } else if ((targetInputKlasifikasi === 'tsKode' || targetInputKlasifikasi === 'sptKode') && typeof updatePreviewPerjadin === 'function') {
            updatePreviewPerjadin();
        }
    }
    
    // Tutup Modal
    if(myModalKlasifikasi) myModalKlasifikasi.hide();
}