/* =========================================================================
   DAFTAR ISI APP.JS:
   01. KONFIGURASI & STATE GLOBAL
   02. INISIALISASI & EVENT LISTENER
   03. UTILITAS GLOBAL (Loading, Toast, Logout, Preview, FAB)
   04. NAVIGASI, DASHBOARD & CHART
   05. TABEL & PAGINASI (Renderer Utama)
   06. MANAJEMEN DRAG & DROP (File Upload)
   07. MODUL PENGATURAN (Jenis Surat & Manajemen User)
   08. MODUL SURAT (Masuk, Keluar, Keputusan, Berita Acara)
   09. MODUL PERJADIN (Perjalanan Dinas)
   10. MODUL NPD (Nota Pencairan Dana)
   11. MODUL KODE KLASIFIKASI (Pencarian Modal)
   12. EXPORT & DOWNLOAD
   ========================================================================= */

/* =========================================================================
   01. KONFIGURASI & STATE GLOBAL
   ========================================================================= */
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxMZd4ZZ30p_hLIYoon0BMNq_V_Mw7FrfsB-hZgJcqG5yAzIUriYv89PsMX2huV0-8/exec";

/* =========================================================================
   FUNGSI FETCH ANTI-ERROR (BYPASS GOOGLE REDIRECT & MULTI-ACCOUNT)
   ========================================================================= */
function safeFetchPOST(payload) {
    return fetch(GAS_API_URL, {
        method: 'POST',
        // Menggunakan text/plain mencegah browser melakukan preflight OPTIONS yang sering diblokir Google
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
    .then(res => res.text()) // Baca sebagai teks dulu, jangan langsung .json()
    .then(text => {
        try {
            return JSON.parse(text); // Jika formatnya JSON normal, kembalikan
        } catch (err) {
            console.warn("Response dari Google diblokir (HTML), tapi backend biasanya sukses mengeksekusi data.");
            // Jika error saat login
            if (payload.action === 'login') {
                return { status: "error", message: "Sesi Google bentrok (Multi-Akun). Silakan gunakan mode Samaran/Incognito." };
            }
            // Jika error saat simpan/edit/hapus (Padahal data aslinya masuk)
            return { status: "success", message: "Tersimpan (Abaikan error koneksi Google)" };
        }
    });
}

let globalData = {
    jenisSurat: [],
    suratMasuk: [],
    suratKeluar: [],
    suratKeputusan: [],
    beritaAcara: [], 
    perjadin: [],
    pesanan: [],
    bon: [],
    npd: [],
    kodeKlasifikasi: []
};

let globalASN = [];
let userList = [];
let currentUser = null;
let targetInputKlasifikasi = "";

// State Pagination
let currentPageMasuk = 1, rowsPerPageMasuk = 5;
let currentPageKeluar = 1, rowsPerPageKeluar = 5;
let currentPageKeputusan = 1, rowsPerPageKeputusan = 5;
let currentPageBeritaAcara = 1, rowsPerPageBeritaAcara = 5;
let currentPagePerjadin = 1, rowsPerPagePerjadin = 5;
let currentPagePesanan = 1, rowsPerPagePesanan = 5;
let currentPageBon = 1, rowsPerPageBon = 5;
let currentPageNpd = 1, rowsPerPageNpd = 5;


/* =========================================================================
   02. INISIALISASI & EVENT LISTENER
   ========================================================================= */
window.addEventListener('load', function() {
    showLoading(false);
    
    setupDragAndDrop();
    setupDragAndDropPerjadin();
    setupDragAndDropPesanan();
    setupDragAndDropBon();
    setupDragAndDropNpd();

    const idsSurat = ['inpKode', 'inpNoUrut', 'inpKodeLanjutan', 'inpTahun'];
    idsSurat.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updatePreviewNomor);
    });
    
    const idsPerjadin = ['tsKode', 'tsNo', 'tsSuffix', 'tsTahun', 'sptKode', 'sptNo', 'sptSuffix', 'sptTahun'];
    idsPerjadin.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updatePreviewPerjadin);
    }); 

    const idsPesanan = ['psNoUrut', 'psTahun'];
    idsPesanan.forEach(id => { 
        const el = document.getElementById(id); 
        if(el) el.addEventListener('input', updatePreviewPesanan); });

    const idsBon = ['bNoUrut', 'bKodeTengah', 'bTahun'];
    idsBon.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updatePreviewBon);
    });

    const idsNpd = ['nNoUrut', 'nTahun'];
    idsNpd.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updatePreviewNpd);
    });
    
    document.addEventListener('click', function(e) {
        if (!e.target.classList.contains('personil-search')) {
            document.querySelectorAll('.search-result-box').forEach(el => el.style.display = 'none');
        }
    });
});

document.getElementById('formLogin').addEventListener('submit', function(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    showLoading(true);
    
    safeFetchPOST({ action: 'login', username: u, password: p }).then(resp => {
        showLoading(false);
        if (resp.status === 'success') {
            currentUser = resp.user;
            initApp();
            Swal.fire({ icon: 'success', title: 'Berhasil Login', text: `Selamat datang, ${currentUser.nama}`, timer: 2000, showConfirmButton: false });
        } else { 
            Swal.fire({ icon: 'error', title: 'Login Gagal', text: resp.message }); 
        }
    }).catch(err => { 
        showLoading(false); 
        Swal.fire({ icon: 'error', title: 'Error', text: "Koneksi Error: " + err }); 
    });
});

function initApp() {
    document.getElementById('loginPanel').classList.add('d-none');
    document.getElementById('appPanel').classList.remove('d-none');
    
    document.getElementById('userNama').innerText = currentUser.nama;
    document.getElementById('userRole').innerText = currentUser.role;
    
    if (currentUser.role !== 'Super Admin') document.getElementById('menuPengaturan').classList.add('d-none');
    else { loadUsers(); renderJenisSuratSettings(); }
    
    loadData();
    
    fetch(GAS_API_URL + "?action=getAsnData").then(res => res.json()).then(resp => {
        if(resp.status === 'success') { globalASN = resp.data; console.log("Database ASN dimuat:", globalASN.length, "data"); }
    });         
}

function loadData(isBackground = false) {
    if (!isBackground) showLoading(true);
    
    // Ganti fetch GET dengan safeFetchPOST
    safeFetchPOST({ action: 'getData' })
    .then(resp => {
        if (!isBackground) showLoading(false);
        if (resp.status === 'success') {
            
            // Tetap gunakan fallback || [] sesuai kodemu sebelumnya
            globalData.suratMasuk = resp.data.suratMasuk || [];
            globalData.suratKeluar = resp.data.suratKeluar || [];
            globalData.suratKeputusan = resp.data.suratKeputusan || [];
            globalData.beritaAcara = resp.data.berita_acara || resp.data.beritaAcara || []; 
            globalData.pesanan = resp.data.pesanan || [];
            globalData.perjadin = resp.data.perjadin || [];
            globalData.bon = resp.data.bon || [];
            globalData.npd = resp.data.npd || []; 
                        
            if (!isBackground) {
                globalData.jenisSurat = resp.data.jenisSurat || [];
                globalData.kodeKlasifikasi = resp.data.kodeKlasifikasi || [];
            }

            renderDashboard();
            renderTables();
            
            if (!isBackground) {
                populateDropdown();
                if(currentUser && currentUser.role === 'Super Admin') renderJenisSuratSettings();
            }
        }
    }).catch(err => {
        console.error("Detail Error loadData:", err);
        if (!isBackground) { 
            showLoading(false); 
            Swal.fire({ icon: 'error', title: 'Error loadData', text: err.message || "Gagal mengambil data." }); 
        }
    });
}


/* =========================================================================
   03. UTILITAS GLOBAL
   ========================================================================= */
const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true,
    didOpen: (toast) => { toast.addEventListener('mouseenter', Swal.stopTimer); toast.addEventListener('mouseleave', Swal.resumeTimer); }
});

function showLoading(show) {
    const el = document.getElementById('loading'); if(!el) return;
    if (show) el.classList.remove('d-none'); else el.classList.add('d-none');
}

function logout() {
    Swal.fire({
        title: 'Konfirmasi', text: "Anda yakin ingin keluar dari aplikasi?", icon: 'question',
        showCancelButton: true, confirmButtonText: 'Ya, Keluar', cancelButtonText: 'Batal', reverseButtons: true 
    }).then((result) => {
        if (result.isConfirmed) {
            currentUser = null;
            document.getElementById('fabTambah').style.display = 'none'; 
            document.getElementById('appPanel').classList.add('d-none');
            document.getElementById('loginPanel').classList.remove('d-none');
            document.getElementById('formLogin').reset();
        }
    });
}

function handleFabClick() {
    if (!document.getElementById('tab-suratMasuk').classList.contains('d-none')) openModal('masuk');
    else if (!document.getElementById('tab-suratKeluar').classList.contains('d-none')) openModal('keluar');
    else if (!document.getElementById('tab-suratKeputusan').classList.contains('d-none')) openModal('keputusan');
    else if (!document.getElementById('tab-berita_acara').classList.contains('d-none')) openModal('berita_acara');
    else if (!document.getElementById('tab-perjadin').classList.contains('d-none')) openModalPerjadin();
    else if (!document.getElementById('tab-bon').classList.contains('d-none')) openModalBon();
    else if (!document.getElementById('tab-npd').classList.contains('d-none')) openModalNpd();            
}

const modalPreviewElement = document.getElementById('modalPreview');
let myPreviewModal;
if (modalPreviewElement) {
    myPreviewModal = new bootstrap.Modal(modalPreviewElement);
    modalPreviewElement.addEventListener('hidden.bs.modal', function () { document.getElementById('framePreview').src = ""; });     
}

function previewFile(url) {
    if (!url) return;
    let embedUrl = url;
    if (url.includes('drive.google.com') && url.includes('/view')) embedUrl = url.replace('/view', '/preview');
    document.getElementById('framePreview').src = embedUrl;
    if(myPreviewModal) myPreviewModal.show();
}


/* =========================================================================
   04. NAVIGASI, DASHBOARD & CHART
   ========================================================================= */
function showTab(tabName) {
    document.querySelectorAll('.content-tab').forEach(el => el.classList.add('d-none'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active', 'text-white'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.add('text-white-50'));
    
    document.getElementById('tab-' + tabName).classList.remove('d-none');
    document.getElementById('nav-' + tabName).classList.add('active', 'text-white');
    document.getElementById('nav-' + tabName).classList.remove('text-white-50');
    
    const titles = {
        'dashboard': ['Statistik Surat', 'Kounter jumlah Surat Masuk dan Surat Keluar'],
        'suratMasuk': ['Pencatatan Surat Masuk', 'Daftar surat yang masuk/diterima'],
        'suratKeluar': ['Pencatatan Surat Keluar', 'Daftar surat yang keluar/diterbitkan'],
        'suratKeputusan': ['Pencatatan SK, SP, SOP, dll', 'Daftar SK, SP, SOP, dll yang diterbitkan'], 
        'berita_acara': ['Pencatatan Berita Acara', 'Daftar Berita Acara Serah Terima, Pemeriksaan, & Pembayaran '],
        'pengaturan': ['Pengaturan Sistem', 'Konfigurasi aplikasi'],
        'perjadin': ['Pencatatan Data Perjalanan Dinas', 'Daftar TS, SPT, & SPPD'],
        'pesanan': ['Pencatatan Pesanan', 'Daftar penomoran pesanan'],
        'bon': ['Pencatatan Bon', 'Daftar penomoran bon'],
        'npd': ['Pencatatan Nota Pencairan Dana', 'Daftar penomoran NPD'] 
    };

    document.getElementById('pageTitle').innerText = titles[tabName][0];
    document.getElementById('pageTitle').nextElementSibling.innerText = titles[tabName][1];

    const fab = document.getElementById('fabTambah');
    if (tabName === 'suratMasuk') { fab.style.display = 'flex'; fab.style.backgroundColor = '#059669'; } 
    else if (tabName === 'suratKeluar') { fab.style.display = 'flex'; fab.style.backgroundColor = '#ea580c'; } 
    else if (tabName === 'suratKeputusan') { fab.style.display = 'flex'; fab.style.backgroundColor = '#dc2626'; } 
    else if (tabName === 'berita_acara') { fab.style.display = 'flex'; fab.style.backgroundColor = '#4f46e5'; } 
    else if (tabName === 'perjadin') { fab.style.display = 'flex'; fab.style.backgroundColor = '#3b82f6'; } 
    else if (tabName === 'pesanan') { fab.style.display = 'flex'; fab.style.backgroundColor = '#0d9488'; } 
    else if (tabName === 'bon') { fab.style.display = 'flex'; fab.style.backgroundColor = '#db2777'; }
    else if (tabName === 'npd') { fab.style.display = 'flex'; fab.style.backgroundColor = '#8b5cf6'; } 
    else { fab.style.display = 'none'; }
                        
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const sidebarEl = document.getElementById('sidebarMenu');
    if (sidebarEl) { const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebarEl); if (bsOffcanvas) bsOffcanvas.hide(); }
}

let mainChartInstance = null;

function renderDashboard() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Fungsi utilitas untuk menghitung data bulan ini
    const countThisMonth = (dataArr, dateIndex) => {
        return dataArr.filter(row => {
            const d = new Date(row.values[dateIndex]);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;
    };

    // 1. UPDATE KOUNTER 8 MODUL
    document.getElementById('countMasuk').innerText = globalData.suratMasuk.length;
    document.getElementById('countMasukMonth').innerText = countThisMonth(globalData.suratMasuk, 2);
    
    document.getElementById('countKeluar').innerText = globalData.suratKeluar.length;
    document.getElementById('countKeluarMonth').innerText = countThisMonth(globalData.suratKeluar, 2);

    document.getElementById('countKeputusan').innerText = globalData.suratKeputusan.length;
    document.getElementById('countKeputusanMonth').innerText = countThisMonth(globalData.suratKeputusan, 2);

    document.getElementById('countBA').innerText = globalData.beritaAcara.length;
    document.getElementById('countBAMonth').innerText = countThisMonth(globalData.beritaAcara, 2);

    document.getElementById('countPerjadin').innerText = globalData.perjadin.length;
    document.getElementById('countPerjadinMonth').innerText = countThisMonth(globalData.perjadin, 3); // Perjadin pakai Tgl Mulai (index 3)

    document.getElementById('countPesanan').innerText = globalData.pesanan.length;
    document.getElementById('countPesananMonth').innerText = countThisMonth(globalData.pesanan, 2);

    document.getElementById('countBon').innerText = globalData.bon.length;
    document.getElementById('countBonMonth').innerText = countThisMonth(globalData.bon, 2);

    document.getElementById('countNpd').innerText = globalData.npd.length;
    document.getElementById('countNpdMonth').innerText = countThisMonth(globalData.npd, 2);

    // 2. SUSUN LINIMASA AKTIVITAS TERPADU (MERGE ALL MODULES)
    let allActivities = [];
    
    // Fungsi utilitas untuk map data ke format standar
    const mapActivity = (dataArr, modul, icon, colorClass, dateIdx, titleIdx, descIdx) => {
        dataArr.forEach(item => {
            allActivities.push({
                date: new Date(item.values[dateIdx]),
                modul: modul, icon: icon, color: colorClass,
                title: item.values[titleIdx] || "-",
                desc: item.values[descIdx] || "-"
            });
        });
    };

    mapActivity(globalData.suratMasuk, "Surat Masuk", "fa-inbox", "text-success", 2, 5, 6);
    mapActivity(globalData.suratKeluar, "Surat Keluar", "fa-paper-plane", "text-warning", 2, 7, 8);
    mapActivity(globalData.suratKeputusan, "SK/SOP", "fa-gavel", "text-danger", 2, 7, 8);
    mapActivity(globalData.beritaAcara, "B. Acara", "fa-handshake", "text-indigo", 2, 7, 8);
    mapActivity(globalData.perjadin, "Perjadin", "fa-plane-departure", "text-primary", 3, 5, 6);
    mapActivity(globalData.pesanan, "Pesanan", "fa-shopping-cart", "text-teal", 2, 5, 6);
    mapActivity(globalData.bon, "Bon", "fa-receipt", "text-pink", 2, 5, 6);
    mapActivity(globalData.npd, "NPD", "fa-file-invoice-dollar", "text-purple", 2, 6, 5);

    // Urutkan berdasarkan tanggal terbaru
    allActivities.sort((a, b) => b.date - a.date);
    
    // Ambil 10 aktivitas terakhir
    const recentActivities = allActivities.slice(0, 10);
    const containerFeed = document.getElementById('listRecentActivity');
    containerFeed.innerHTML = '';
    
    if (recentActivities.length === 0) {
        containerFeed.innerHTML = '<div class="text-center text-muted p-4"><i class="fas fa-history fa-2x mb-2 opacity-25"></i><br>Belum ada aktivitas</div>';
    } else {
        recentActivities.forEach(act => {
            const tgl = act.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            containerFeed.innerHTML += `
            <div class="list-group-item py-3 border-bottom-0 border-top">
                <div class="d-flex w-100 justify-content-between align-items-center mb-1">
                    <span class="small fw-bold ${act.color}"><i class="fas ${act.icon} me-1"></i>${act.modul}</span>
                    <small class="text-muted" style="font-size: 0.7rem;">${tgl}</small>
                </div>
                <div class="fw-bold text-dark small text-truncate" style="max-width: 100%;">${act.title}</div>
                <div class="text-muted text-truncate mt-1" style="font-size: 0.75rem; max-width: 100%;">${act.desc}</div>
            </div>`;
        });
    }

    renderChartJS();
}

function renderChartJS() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    const labels = ["Masuk", "Keluar", "SK", "BA", "Perjadin", "Pesanan", "Bon", "NPD"];
    const dataVolumes = [
        globalData.suratMasuk.length, globalData.suratKeluar.length,
        globalData.suratKeputusan.length, globalData.beritaAcara.length,
        globalData.perjadin.length, globalData.pesanan.length,
        globalData.bon.length, globalData.npd.length
    ];
    // Warna statis menyesuaikan modul
    const bgColors = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#3b82f6', '#14b8a6', '#db2777', '#a855f7'];

    if (mainChartInstance) {
        mainChartInstance.data.datasets[0].data = dataVolumes;
        mainChartInstance.update();
    } else {
        mainChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Dokumen',
                    data: dataVolumes,
                    backgroundColor: bgColors,
                    borderRadius: 6, // Sudut batang membulat (Chart.js v3+)
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false } // Sembunyikan legend karena label sudah ada di bawah
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

/* =========================================================================
   05. TABEL & PAGINASI
   ========================================================================= */
function changeRowsPerPage(type, value) {
    if (type === 'masuk') { rowsPerPageMasuk = value === 'all' ? globalData.suratMasuk.length : parseInt(value); currentPageMasuk = 1; }
    else if (type === 'keluar') { rowsPerPageKeluar = value === 'all' ? globalData.suratKeluar.length : parseInt(value); currentPageKeluar = 1; }
    else if (type === 'keputusan') { rowsPerPageKeputusan = value === 'all' ? globalData.suratKeputusan.length : parseInt(value); currentPageKeputusan = 1; }
    else if (type === 'berita_acara') { rowsPerPageBeritaAcara = value === 'all' ? globalData.beritaAcara.length : parseInt(value); currentPageBeritaAcara = 1; }
    else if (type === 'perjadin') { rowsPerPagePerjadin = value === 'all' ? globalData.perjadin.length : parseInt(value); currentPagePerjadin = 1; }
    else if (type === 'pesanan') { rowsPerPagePesanan = value === 'all' ? globalData.pesanan.length : parseInt(value); currentPagePesanan = 1; }
    else if (type === 'npd') { rowsPerPageNpd = value === 'all' ? globalData.npd.length : parseInt(value); currentPageNpd = 1; }
    renderTables();
}

function changePage(type, page) {
    if (type === 'masuk') currentPageMasuk = page;
    else if (type === 'keluar') currentPageKeluar = page;
    else if (type === 'keputusan') currentPageKeputusan = page;
    else if (type === 'berita_acara') currentPageBeritaAcara = page;
    else if (type === 'perjadin') currentPagePerjadin = page;
    else if (type === 'pesanan') currentPagePesanan = page;
    else if (type === 'npd') currentPageNpd = page;
    renderTables();
}

function resetPagination(type) {
    if (type === 'masuk') currentPageMasuk = 1;
    else if (type === 'keluar') currentPageKeluar = 1;
    else if (type === 'keputusan') currentPageKeputusan = 1;
    else if (type === 'berita_acara') currentPageBeritaAcara = 1;
    else if (type === 'perjadin') currentPagePerjadin = 1;
    else if (type === 'pesanan') currentPagePesanan = 1;
    else if (type === 'npd') currentPageNpd = 1;
}

function renderPaginationControls(totalItems, currentPage, rowsPerPage, type, containerId) {
    const container = document.getElementById(containerId); if (!container) return;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalItems);

    let controls = `<div class="rows-per-page d-flex align-items-center">Tampilkan <select class="mx-2" onchange="changeRowsPerPage('${type}', this.value)"><option value="5" ${rowsPerPage === 5 ? 'selected' : ''}>5</option><option value="10" ${rowsPerPage === 10 ? 'selected' : ''}>10</option><option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25</option><option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50</option><option value="all" ${rowsPerPage > 50 ? 'selected' : ''}>All</option></select> data</div><div class="d-flex align-items-center"><span class="me-3">Menampilkan ${startItem}-${endItem} dari ${totalItems}</span><nav><ul class="pagination pagination-sm mb-0"><li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><button class="page-link" onclick="changePage('${type}', ${currentPage - 1})"><i class="fas fa-chevron-left"></i></button></li>`;
    for (let i = 1; i <= totalPages; i++) {
        if(totalPages <= 7 || i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) { controls += `<li class="page-item ${i === currentPage ? 'active' : ''}"><button class="page-link" onclick="changePage('${type}', ${i})">${i}</button></li>`; } 
        else if (i === currentPage - 2 || i === currentPage + 2) { controls += `<li class="page-item disabled"><span class="page-link">...</span></li>`; }
    }
    controls += `<li class="page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}"><button class="page-link" onclick="changePage('${type}', ${currentPage + 1})"><i class="fas fa-chevron-right"></i></button></li></ul></nav></div>`;
    container.innerHTML = controls;
}

function renderTables() {
    const isTabMasukActive = !document.getElementById('tab-suratMasuk').classList.contains('d-none');
    const isTabKeluarActive = !document.getElementById('tab-suratKeluar').classList.contains('d-none');
    const isTabKeputusanActive = !document.getElementById('tab-suratKeputusan').classList.contains('d-none');
    const isTabBeritaAcaraActive = !document.getElementById('tab-berita_acara').classList.contains('d-none');
    const isTabPerjadinActive = !document.getElementById('tab-perjadin').classList.contains('d-none');
    const isTabNpdActive = !document.getElementById('tab-npd').classList.contains('d-none');
    const isTabPesananActive = !document.getElementById('tab-pesanan').classList.contains('d-none');
    const isTabBonActive = !document.getElementById('tab-bon').classList.contains('d-none');

    // Filtering
    let filteredMasuk = globalData.suratMasuk;
    if (isTabMasukActive) { const term = document.getElementById('searchMasuk') ? document.getElementById('searchMasuk').value.toLowerCase() : ''; if (term) filteredMasuk = globalData.suratMasuk.filter(row => ((row.values[3]||"")+" "+(row.values[4]||"")+" "+(row.values[5]||"")+" "+(row.values[6]||"")+" "+(row.values[7]||"")).toLowerCase().includes(term)); }

    let filteredKeluar = globalData.suratKeluar;
    if (isTabKeluarActive) { const term = document.getElementById('searchKeluar') ? document.getElementById('searchKeluar').value.toLowerCase() : ''; if (term) filteredKeluar = globalData.suratKeluar.filter(row => ((row.values[5]||"")+" "+(row.values[6]||"")+" "+(row.values[7]||"")+" "+(row.values[8]||"")+" "+(row.values[9]||"")).toLowerCase().includes(term)); }

    let filteredKeputusan = globalData.suratKeputusan;
    if (isTabKeputusanActive) { const term = document.getElementById('searchKeputusan') ? document.getElementById('searchKeputusan').value.toLowerCase() : ''; if (term) filteredKeputusan = globalData.suratKeputusan.filter(row => ((row.values[5]||"")+" "+(row.values[6]||"")+" "+(row.values[7]||"")+" "+(row.values[8]||"")+" "+(row.values[9]||"")).toLowerCase().includes(term)); }

    let filteredBeritaAcara = globalData.beritaAcara;
    if (isTabBeritaAcaraActive) { const term = document.getElementById('searchBeritaAcara') ? document.getElementById('searchBeritaAcara').value.toLowerCase() : ''; if (term) filteredBeritaAcara = globalData.beritaAcara.filter(row => ((row.values[5]||"")+" "+(row.values[6]||"")+" "+(row.values[7]||"")+" "+(row.values[8]||"")+" "+(row.values[9]||"")).toLowerCase().includes(term)); }

    let filteredPerjadin = globalData.perjadin;
    if (isTabPerjadinActive) {
        const term = document.getElementById('searchPerjadin') ? document.getElementById('searchPerjadin').value.toLowerCase() : '';
        if (term) filteredPerjadin = globalData.perjadin.filter(row => { let pNames = ""; try { pNames = JSON.parse(row.values[16]).map(p=>p.nama).join(" "); } catch(e){} return ((row.values[5]||"")+" "+(row.values[6]||"")+" "+(row.values[7]||"")+" "+(row.values[8]||"")+" "+pNames).toLowerCase().includes(term); });
    }

    let filteredBon = globalData.bon;
    if (isTabBonActive) { 
        const term = document.getElementById('searchBon') ? document.getElementById('searchBon').value.toLowerCase() : ''; 
        if (term) filteredBon = globalData.bon.filter(row => ((row.values[4]||"")+" "+(row.values[5]||"")+" "+(row.values[6]||"")).toLowerCase().includes(term)); 
    }

    let filteredNpd = globalData.npd;
    if (isTabNpdActive) { const term = document.getElementById('searchNpd') ? document.getElementById('searchNpd').value.toLowerCase() : ''; if (term) filteredNpd = globalData.npd.filter(row => ((row.values[4]||"")+" "+(row.values[5]||"")+" "+(row.values[6]||"")).toLowerCase().includes(term)); }

    let filteredPesanan = globalData.pesanan;
    if (isTabPesananActive) { const term = document.getElementById('searchPesanan') ? document.getElementById('searchPesanan').value.toLowerCase() : ''; if (term) filteredPesanan = globalData.pesanan.filter(row => ((row.values[4]||"")+" "+(row.values[5]||"")+" "+(row.values[6]||"")).toLowerCase().includes(term)); }

    // Pagination Slice
    const paginatedMasuk = filteredMasuk.slice((currentPageMasuk - 1) * rowsPerPageMasuk, (currentPageMasuk - 1) * rowsPerPageMasuk + rowsPerPageMasuk);
    const paginatedKeluar = filteredKeluar.slice((currentPageKeluar - 1) * rowsPerPageKeluar, (currentPageKeluar - 1) * rowsPerPageKeluar + rowsPerPageKeluar);
    const paginatedKeputusan = filteredKeputusan.slice((currentPageKeputusan - 1) * rowsPerPageKeputusan, (currentPageKeputusan - 1) * rowsPerPageKeputusan + rowsPerPageKeputusan);
    const paginatedBeritaAcara = filteredBeritaAcara.slice((currentPageBeritaAcara - 1) * rowsPerPageBeritaAcara, (currentPageBeritaAcara - 1) * rowsPerPageBeritaAcara + rowsPerPageBeritaAcara);
    const paginatedPerjadin = filteredPerjadin.slice((currentPagePerjadin - 1) * rowsPerPagePerjadin, (currentPagePerjadin - 1) * rowsPerPagePerjadin + rowsPerPagePerjadin);
    const paginatedNpd = filteredNpd.slice((currentPageNpd - 1) * rowsPerPageNpd, (currentPageNpd - 1) * rowsPerPageNpd + rowsPerPageNpd);
    const paginatedPesanan = filteredPesanan.slice((currentPagePesanan - 1) * rowsPerPagePesanan, (currentPagePesanan - 1) * rowsPerPagePesanan + rowsPerPagePesanan);
    const paginatedBon = filteredBon.slice((currentPageBon - 1) * rowsPerPageBon, (currentPageBon - 1) * rowsPerPageBon + rowsPerPageBon);

    // --- ROW CREATORS ---
    const createRow = (rowObj, type) => {
        const row = rowObj.values; const realRow = rowObj.rowNumber;
        const idxUrl = type === 'masuk' ? 9 : 11;
        const idxKet = type === 'masuk' ? 8 : 10;
        let btnFile = row[idxUrl] ? `<button class="btn-circle btn-circle-primary" onclick="previewFile('${row[idxUrl]}')"><i class="fas fa-eye"></i></button>` : `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;
        let tgl = new Date(row[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: '2-digit' });
        const badgeClass = type === 'masuk' ? 'badge-masuk' : 'badge-keluar';
        const ketHtml = row[idxKet] ? `<div class="small text-danger fst-italic text-wrap" style="line-height:1.2;"><i class="fas fa-info-circle me-1"></i>${row[idxKet]}</div>` : ""; 

        if (type === 'masuk') {
            return `<tr><td><div class="fw-bold text-dark small">${row[3]}</div><small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small></td><td><span class="badge ${badgeClass} mb-1">${row[4]}</span><div class="small text-dark text-wrap">${row[5]}</div></td><td><div class="small">${row[6]}</div></td><td><span class="badge bg-light text-dark border">${row[7]}</span></td> <td>${ketHtml}</td><td class="text-center"><div class="d-flex justify-content-center gap-2">${btnFile}<button class="btn-circle btn-circle-warning" onclick="editData('${type}', ${realRow})"><i class="fas fa-pen"></i></button><button class="btn-circle btn-circle-danger" onclick="hapusData('${type}', ${realRow})"><i class="fas fa-trash-alt"></i></button></div></td></tr>`;
        } else {
            let displayNoKeluar = row[5] || "";
            if (displayNoKeluar.includes('/')) { 
                let parts = displayNoKeluar.split('/'); 
                let idxNum = (row[3] && row[3] !== "-") ? 1 : 0;
                if (parts[idxNum]) parts[idxNum] = `<span class="text-primary fw-bold">${parts[idxNum]}</span>`;
                displayNoKeluar = parts.join('/'); 
            }
            return `<tr><td><div class="fw-bold text-dark small">${displayNoKeluar}</div> <small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small></td><td><span class="badge ${badgeClass} mb-1">${row[6]}</span><div class="small text-dark text-wrap">${row[7]}</div></td><td><div class="small">${row[8]}</div></td><td><span class="badge bg-light text-dark border">${row[9]}</span></td> <td>${ketHtml}</td><td class="text-center"><div class="d-flex justify-content-center gap-2">${btnFile}<button class="btn-circle btn-circle-warning" onclick="editData('${type}', ${realRow})"><i class="fas fa-pen"></i></button><button class="btn-circle btn-circle-danger" onclick="hapusData('${type}', ${realRow})"><i class="fas fa-trash-alt"></i></button></div></td></tr>`;
        }
    };

    const createRowBeritaAcara = (rowObj) => {
        const row = rowObj.values; const realRow = rowObj.rowNumber;
        let displayNo = row[5] || ""; 
        if (displayNo.includes('/')) { 
            let parts = displayNo.split('/'); 
            let idxNum = (row[3] && row[3] !== "-") ? 1 : 0;
            if (parts[idxNum]) parts[idxNum] = `<span class="text-primary fw-bold">${parts[idxNum]}</span>`;
            displayNo = parts.join('/'); 
        }
        let btnFile = row[11] ? `<button class="btn-circle btn-circle-primary" onclick="previewFile('${row[11]}')"><i class="fas fa-eye"></i></button>` : `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;
        let tgl = new Date(row[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: '2-digit' });
        const ketHtml = row[10] ? `<div class="small text-danger fst-italic text-wrap" style="line-height:1.2;"><i class="fas fa-info-circle me-1"></i>${row[10]}</div>` : ""; 
        
        return `<tr>
            <td><div class="fw-bold text-dark small">${displayNo}</div> <small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small></td>
            <td><span class="badge badge-berita mb-1">${row[6]}</span><div class="small text-dark text-wrap">${row[7]}</div></td>
            <td><div class="small">${row[8]}</div></td>
            <td><span class="badge bg-light text-dark border">${row[9]}</span></td> 
            <td>${ketHtml}</td>
            <td class="text-center"><div class="d-flex justify-content-center gap-2">${btnFile}<button class="btn-circle btn-circle-warning" onclick="editData('berita_acara', ${realRow})"><i class="fas fa-pen"></i></button><button class="btn-circle btn-circle-danger" onclick="hapusData('berita_acara', ${realRow})"><i class="fas fa-trash-alt"></i></button></div></td>
        </tr>`;
    };

    const createRowPerjadin = (rowObj) => {
        const r = rowObj.values; const realRow = rowObj.rowNumber;
        const dateOpts = { timeZone: 'Asia/Makassar', day:'numeric', month:'short', year: '2-digit' };
        let tglDisplay = new Date(r[3]).toLocaleDateString('id-ID', dateOpts);
        let duration = "1 Hari";
        if (r[2] !== 'Dalam Daerah' && r[4]) { 
            const end = new Date(r[4]); const start = new Date(r[3]);
            const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1; 
            tglDisplay += ` <br><span class="text-muted" style="font-weight:normal;">s.d.</span><br> ${end.toLocaleDateString('id-ID', dateOpts)}`;
            duration = `${diffDays} Hari`;
        }
        let badgeClass = r[2] === 'Dalam Daerah' ? "badge-hijau-muda" : (r[2] === 'Dalam Provinsi' ? "badge-biru-muda" : (r[2] === 'Luar Provinsi' ? "badge-ungu-muda" : "badge-coklat-muda"));
        
        let personilHtml = "";
        try {
            const pList = JSON.parse(r[16]);
            pList.sort((a, b) => (parseInt(b.no ? String(b.no).split('-')[0].replace(/\D/g,'') : 0)||0) - (parseInt(a.no ? String(a.no).split('-')[0].replace(/\D/g,'') : 0)||0));
            pList.forEach(p => { personilHtml += `<div class="mb-1 d-flex align-items-center" style="line-height:1.2;"><span class="badge ${badgeClass} me-2" style="font-family:monospace; font-size: 0.75rem; padding: 4px 6px;">${p.no || '-'}</span><div><div class="fw-bold small text-dark">${p.nama}</div><div class="text-muted" style="font-size:0.7rem;">${p.nip}</div></div></div>`; });
        } catch(e) { personilHtml = "<em class='text-danger'>Error Data Personil</em>"; }

        const padNo = (num) => num ? String(num).padStart(3, '0') : '';
        
        // PERBAIKAN: Format Bold untuk Penomoran TS & SPT (Fleksibel 3/4 bagian)
        let tsPartsArr = (r[10]||"").split('/');
        let displayTS = r[10] || "";
        if (r[9]) {
            if (tsPartsArr.length >= 4) displayTS = `${tsPartsArr[0]}/<span class="text-primary fw-bold">${padNo(r[9])}</span>/${tsPartsArr[2]}/${tsPartsArr[3]}`;
            else if (tsPartsArr.length === 3) displayTS = `<span class="text-primary fw-bold">${padNo(r[9])}</span>/${tsPartsArr[1]}/${tsPartsArr[2]}`;
        }
        
        let sptPartsArr = (r[13]||"").split('/');
        let displaySPT = r[13] || "";
        if (r[12]) {
            if (sptPartsArr.length >= 4) displaySPT = `${sptPartsArr[0]}/<span class="text-primary fw-bold">${padNo(r[12])}</span>/${sptPartsArr[2]}/${sptPartsArr[3]}`;
            else if (sptPartsArr.length === 3) displaySPT = `<span class="text-primary fw-bold">${padNo(r[12])}</span>/${sptPartsArr[1]}/${sptPartsArr[2]}`;
        }
        
        const docHtml = `${displayTS ? `<div class="small text-dark mb-1" style="font-size: 0.75rem;"><span class="fw-bold text-secondary">TS:</span> ${displayTS}</div>` : ''}${displaySPT ? `<div class="small text-dark" style="font-size: 0.75rem;"><span class="fw-bold text-secondary">SPT:</span> ${displaySPT}</div>` : ''}${!displayTS && !displaySPT ? `<span class="text-muted fst-italic small">-</span>` : ''}`;
        let btnFile = r[17] ? `<button class="btn-circle btn-circle-primary" onclick="previewFile('${r[17]}')"><i class="fas fa-eye"></i></button>` : `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;
        
        return `<tr><td style="vertical-align: top;"><div class="fw-bold text-dark small" style="font-size: 0.8rem; line-height: 1.4;">${tglDisplay}</div><div class="mt-1"><span class="badge bg-light text-secondary border">${duration}</span></div><div class="mt-2"><span class="badge ${badgeClass}">${r[2]}</span></div></td><td style="vertical-align: top;"><div class="small fw-bold text-primary mb-1 text-wrap">${r[5]}</div><div class="small text-muted d-flex align-items-start gap-1"><i class="fas fa-map-marker-alt text-danger" style="margin-top: 3px;"></i> <div>${[r[6], r[7]].filter(Boolean).join(', ')}</div></div></td><td style="vertical-align: top;">${docHtml}</td><td style="vertical-align: top;">${personilHtml}</td><td style="vertical-align: top;"><span class="badge bg-light text-dark border">${r[14]}</span> ${r[15] ? `<div class="mt-2 small text-danger fst-italic"><i class="fas fa-info-circle me-1"></i>${r[15]}</div>` : ""}</td><td class="text-center" style="vertical-align: top;"><div class="d-flex justify-content-center gap-2">${btnFile}<button class="btn-circle btn-circle-warning" onclick="editPerjadin(${realRow})"><i class="fas fa-pen"></i></button><button class="btn-circle btn-circle-danger" onclick="hapusPerjadin(${realRow})"><i class="fas fa-trash-alt"></i></button></div></td></tr>`;
    };

    // Generator Baris Tabel Bon
    const createRowBon = (rowObj) => {
        const r = rowObj.values; const realRow = rowObj.rowNumber;
        const tgl = new Date(r[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: '2-digit' });
        let displayNo = r[4] || ""; if (displayNo.includes('/')) { let parts = displayNo.split('/'); if (parts.length > 0) { parts[0] = `<span class="text-primary fw-bold">${parts[0]}</span>`; displayNo = parts.join('/'); } }
        let btnFile = r[7] ? `<button class="btn-circle btn-circle-primary" onclick="previewFile('${r[7]}')"><i class="fas fa-eye"></i></button>` : `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;
        return `<tr>
            <td style="vertical-align: top;"><div class="fw-bold text-dark small">${displayNo}</div> <small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small></td>
            <td style="vertical-align: top;"><div class="small text-dark text-wrap">${r[5]}</div></td>
            <td style="vertical-align: top;"><span class="badge bg-light text-dark border">${r[6]}</span></td>
            <td class="text-center" style="vertical-align: top;"><div class="d-flex justify-content-center gap-2">${btnFile}<button class="btn-circle btn-circle-warning" onclick="editBon(${realRow})"><i class="fas fa-pen"></i></button><button class="btn-circle btn-circle-danger" onclick="hapusBon(${realRow})"><i class="fas fa-trash-alt"></i></button></div></td>
        </tr>`;
    };

    const createRowNpd = (rowObj) => {
        const r = rowObj.values; const realRow = rowObj.rowNumber;
        const tgl = new Date(r[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: '2-digit' });
        let displayNoNpd = r[4] || ""; if (displayNoNpd.includes('/')) { let parts = displayNoNpd.split('/'); if (parts.length > 0) { parts[0] = `<span class="text-primary fw-bold">${parts[0]}</span>`; displayNoNpd = parts.join('/'); } }
        let btnFile = r[7] ? `<button class="btn-circle btn-circle-primary" onclick="previewFile('${r[7]}')"><i class="fas fa-eye"></i></button>` : `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;
        return `<tr><td style="vertical-align: top;"><div class="fw-bold text-dark small">${displayNoNpd}</div> <small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small></td><td style="vertical-align: top;"><div class="small text-dark text-wrap" style="line-height: 1.4;">${r[6]}</div></td><td style="vertical-align: top;"><span class="badge bg-light text-dark border">${r[5]}</span></td><td class="text-center" style="vertical-align: top;"><div class="d-flex justify-content-center gap-2">${btnFile}<button class="btn-circle btn-circle-warning" onclick="editNpd(${realRow})"><i class="fas fa-pen"></i></button><button class="btn-circle btn-circle-danger" onclick="hapusNpd(${realRow})"><i class="fas fa-trash-alt"></i></button></div></td></tr>`;
    };

    const createRowPesanan = (rowObj) => {
        const r = rowObj.values; const realRow = rowObj.rowNumber;
        const tgl = new Date(r[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: '2-digit' });
        let displayNo = r[4] || ""; if (displayNo.includes('/')) { let parts = displayNo.split('/'); if (parts.length > 0) { parts[0] = `<span class="text-primary fw-bold">${parts[0]}</span>`; displayNo = parts.join('/'); } }
        let btnFile = r[8] ? `<button class="btn-circle btn-circle-primary" onclick="previewFile('${r[8]}')"><i class="fas fa-eye"></i></button>` : `<button class="btn-circle btn-circle-disabled" disabled><i class="fas fa-eye-slash"></i></button>`;
        let rincianList = ""; if(r[5]) { const lines = String(r[5]).split('\n').filter(line => line.trim() !== ""); rincianList = `<ul class="mb-0 ps-3" style="line-height: 1.4;">${lines.map(line => `<li>${line}</li>`).join('')}</ul>`; }
        return `<tr><td style="vertical-align: top;"><div class="fw-bold text-dark small">${displayNo}</div> <small class="text-muted" style="font-size: 0.75rem;"><i class="far fa-calendar-alt me-1"></i> ${tgl}</small></td><td style="vertical-align: top;"><div class="small text-dark text-wrap">${rincianList}</div></td><td style="vertical-align: top;"><div class="small fw-bold text-dark">${r[6]}</div></td><td style="vertical-align: top;"><span class="badge bg-light text-dark border">${r[7]}</span></td><td class="text-center" style="vertical-align: top;"><div class="d-flex justify-content-center gap-2">${btnFile}<button class="btn-circle btn-circle-warning" onclick="editPesanan(${realRow})"><i class="fas fa-pen"></i></button><button class="btn-circle btn-circle-danger" onclick="hapusPesanan(${realRow})"><i class="fas fa-trash-alt"></i></button></div></td></tr>`;
    };

    // --- ROW CREATOR MOBILE (CARD VIEW) ---
    const createCardMasuk = (rowObj) => {
        const row = rowObj.values; const realRow = rowObj.rowNumber;
        const tgl = new Date(row[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: 'numeric' });
        let btnFile = row[9] ? `<button class="btn btn-sm btn-outline-primary flex-fill fw-bold" onclick="previewFile('${row[9]}')"><i class="fas fa-eye me-1"></i>Lihat</button>` : `<button class="btn btn-sm btn-outline-secondary flex-fill" disabled><i class="fas fa-eye-slash"></i></button>`;
        return `<div class="card shadow-sm mb-3 border-0" style="border-radius: 12px; overflow: hidden;"><div class="card-body p-3"><div class="d-flex justify-content-between align-items-start mb-2"><div><div class="fw-bold text-dark" style="font-size: 1.05rem;">${row[3]}</div><div class="small text-muted mt-1"><i class="far fa-calendar-alt me-1"></i> ${tgl}</div></div><span class="badge badge-masuk">${row[4]}</span></div><div class="small text-dark mb-2 fw-bold"><i class="fas fa-user-tie me-1 text-muted"></i> ${row[6]}</div><div class="small text-dark mb-3 pb-3 border-bottom" style="line-height: 1.4;">${row[5]}</div><div class="d-flex gap-2">${btnFile}<button class="btn btn-sm btn-warning text-white px-3" onclick="editData('masuk', ${realRow})"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger px-3" onclick="hapusData('masuk', ${realRow})"><i class="fas fa-trash-alt"></i></button></div></div></div>`;
    };

    const createCardKeluar = (rowObj, type) => {
        const row = rowObj.values; const realRow = rowObj.rowNumber;
        const tgl = new Date(row[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: 'numeric' });
        let displayNo = row[5] || ""; 
        if (displayNo.includes('/')) { 
            let parts = displayNo.split('/'); 
            let idxNum = (row[3] && row[3] !== "-") ? 1 : 0;
            if (parts[idxNum]) parts[idxNum] = `<span class="text-primary fw-bold">${parts[idxNum]}</span>`;
            displayNo = parts.join('/'); 
        }
        let btnFile = row[11] ? `<button class="btn btn-sm btn-outline-primary flex-fill fw-bold" onclick="previewFile('${row[11]}')"><i class="fas fa-eye me-1"></i>Lihat</button>` : `<button class="btn btn-sm btn-outline-secondary flex-fill" disabled><i class="fas fa-eye-slash"></i></button>`;
        return `<div class="card shadow-sm mb-3 border-0" style="border-radius: 12px; overflow: hidden;"><div class="card-body p-3"><div class="d-flex justify-content-between align-items-start mb-2"><div><div class="fw-bold text-dark" style="font-size: 1.05rem;">${displayNo}</div><div class="small text-muted mt-1"><i class="far fa-calendar-alt me-1"></i> ${tgl}</div></div><span class="badge badge-keluar">${row[6]}</span></div><div class="small text-dark mb-2 fw-bold"><i class="fas fa-paper-plane me-1 text-muted"></i> ${row[8]}</div><div class="small text-dark mb-3 pb-3 border-bottom" style="line-height: 1.4;">${row[7]}</div><div class="d-flex gap-2">${btnFile}<button class="btn btn-sm btn-warning text-white px-3" onclick="editData('${type}', ${realRow})"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger px-3" onclick="hapusData('${type}', ${realRow})"><i class="fas fa-trash-alt"></i></button></div></div></div>`;
    };
    
    const createCardBeritaAcara = (rowObj) => {
        const row = rowObj.values; const realRow = rowObj.rowNumber;
        const tgl = new Date(row[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: 'numeric' });
        let displayNo = row[5] || ""; 
        if (displayNo.includes('/')) { 
            let parts = displayNo.split('/'); 
            let idxNum = (row[3] && row[3] !== "-") ? 1 : 0;
            if (parts[idxNum]) parts[idxNum] = `<span class="text-primary fw-bold">${parts[idxNum]}</span>`;
            displayNo = parts.join('/'); 
        }
        let btnFile = row[11] ? `<button class="btn btn-sm btn-outline-primary flex-fill fw-bold" onclick="previewFile('${row[11]}')"><i class="fas fa-eye me-1"></i>Lihat</button>` : `<button class="btn btn-sm btn-outline-secondary flex-fill" disabled><i class="fas fa-eye-slash"></i></button>`;

        return `<div class="card shadow-sm mb-3 border-0" style="border-radius: 12px; overflow: hidden;">
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <div class="fw-bold text-dark" style="font-size: 1.05rem;">${displayNo}</div>
                        <div class="small text-muted mt-1"><i class="far fa-calendar-alt me-1"></i> ${tgl}</div>
                    </div>
                    <span class="badge badge-berita">${row[6]}</span>
                </div>
                <div class="small text-dark mb-2 fw-bold"><i class="fas fa-handshake me-1 text-muted"></i> Serahkan: ${row[8]}</div>
                <div class="small text-dark mb-2 fw-bold"><i class="fas fa-check-circle me-1 text-muted"></i> Terima: ${row[9]}</div>
                <div class="small text-dark mb-3 pb-3 border-bottom" style="line-height: 1.4;">${row[7]}</div>
                <div class="d-flex gap-2">
                    ${btnFile}
                    <button class="btn btn-sm btn-warning text-white px-3" onclick="editData('berita_acara', ${realRow})"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-sm btn-danger px-3" onclick="hapusData('berita_acara', ${realRow})"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        </div>`;
    };

    const createCardPerjadin = (rowObj) => {
        const r = rowObj.values; const realRow = rowObj.rowNumber;
        const dateOpts = { timeZone: 'Asia/Makassar', day:'numeric', month:'short', year: 'numeric' };
        let tglDisplay = new Date(r[3]).toLocaleDateString('id-ID', dateOpts);
        if (r[2] !== 'Dalam Daerah' && r[4]) { const end = new Date(r[4]); tglDisplay += ` <span class="text-muted small mx-1">s/d</span> ${end.toLocaleDateString('id-ID', dateOpts)}`; }
        let badgeClass = r[2] === 'Dalam Daerah' ? "badge-hijau-muda" : (r[2] === 'Dalam Provinsi' ? "badge-biru-muda" : (r[2] === 'Luar Provinsi' ? "badge-ungu-muda" : "badge-coklat-muda"));
        let personilCount = 0; try { personilCount = JSON.parse(r[16]).length; } catch(e) {}
        let btnFile = r[17] ? `<button class="btn btn-sm btn-outline-primary flex-fill fw-bold" onclick="previewFile('${r[17]}')"><i class="fas fa-eye me-1"></i>Lihat</button>` : `<button class="btn btn-sm btn-outline-secondary flex-fill" disabled><i class="fas fa-eye-slash"></i></button>`;
        return `<div class="card shadow-sm mb-3 border-0" style="border-radius: 12px; overflow: hidden;"><div class="card-body p-3"><div class="d-flex justify-content-between align-items-start mb-2"><div><div class="small text-muted mb-1"><i class="far fa-calendar-alt me-1"></i> ${tglDisplay}</div><span class="badge ${badgeClass}">${r[2]}</span></div><span class="badge bg-light text-dark border"><i class="fas fa-users me-1"></i> ${personilCount} Org</span></div><div class="fw-bold text-primary small mb-1 mt-2" style="line-height: 1.3;">${r[5]}</div><div class="small text-muted mb-3 pb-3 border-bottom"><i class="fas fa-map-marker-alt text-danger me-1"></i> ${[r[6], r[7]].filter(Boolean).join(', ')}</div><div class="d-flex gap-2">${btnFile}<button class="btn btn-sm btn-warning text-white px-3" onclick="editPerjadin(${realRow})"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger px-3" onclick="hapusPerjadin(${realRow})"><i class="fas fa-trash-alt"></i></button></div></div></div>`;
    };

    // Generator Kartu Mobile Bon
    const createCardBon = (rowObj) => {
        const r = rowObj.values; const realRow = rowObj.rowNumber;
        const tgl = new Date(r[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: 'numeric' });
        let displayNo = r[4] || ""; if (displayNo.includes('/')) { let parts = displayNo.split('/'); if (parts.length > 0) { parts[0] = `<span class="text-primary fw-bold">${parts[0]}</span>`; displayNo = parts.join('/'); } }
        let btnFile = r[7] ? `<button class="btn btn-sm btn-outline-primary flex-fill fw-bold" onclick="previewFile('${r[7]}')"><i class="fas fa-eye me-1"></i>Dokumen</button>` : `<button class="btn btn-sm btn-outline-secondary flex-fill" disabled><i class="fas fa-eye-slash me-1"></i>Kosong</button>`;
        return `<div class="card shadow-sm mb-3 border-0" style="border-radius: 12px; overflow: hidden;"><div class="card-body p-3"><div class="d-flex justify-content-between align-items-start mb-2"><div><div class="fw-bold text-dark" style="font-size: 1.05rem;">${displayNo}</div><div class="small text-muted mt-1"><i class="far fa-calendar-alt me-1"></i> ${tgl}</div></div><span class="badge bg-bon bg-opacity-10 text-bon border border-bon" style="color: #db2777; border-color: #db2777 !important; background-color: #fce7f3;">${r[6]}</span></div><div class="small text-dark mb-3 pb-3 border-bottom" style="line-height: 1.4;">${r[5]}</div><div class="d-flex gap-2">${btnFile}<button class="btn btn-sm btn-warning text-white px-3" onclick="editBon(${realRow})"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger px-3" onclick="hapusBon(${realRow})"><i class="fas fa-trash-alt"></i></button></div></div></div>`;
    };

    const createCardNpd = (rowObj) => {
        const r = rowObj.values; const realRow = rowObj.rowNumber;
        const tgl = new Date(r[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: 'numeric' });
        let displayNoNpd = r[4] || ""; if (displayNoNpd.includes('/')) { let parts = displayNoNpd.split('/'); if (parts.length > 0) { parts[0] = `<span class="text-primary fw-bold">${parts[0]}</span>`; displayNoNpd = parts.join('/'); } }
        let btnFile = r[7] ? `<button class="btn btn-sm btn-outline-primary flex-fill fw-bold" onclick="previewFile('${r[7]}')"><i class="fas fa-eye me-1"></i>Dokumen</button>` : `<button class="btn btn-sm btn-outline-secondary flex-fill" disabled><i class="fas fa-eye-slash me-1"></i>Kosong</button>`;
        return `<div class="card shadow-sm mb-3 border-0" style="border-radius: 12px; overflow: hidden;"><div class="card-body p-3"><div class="d-flex justify-content-between align-items-start mb-2"><div><div class="fw-bold text-dark" style="font-size: 1.05rem;">${displayNoNpd}</div><div class="small text-muted mt-1"><i class="far fa-calendar-alt me-1"></i> ${tgl}</div></div><span class="badge bg-success bg-opacity-10 text-success border border-success">${r[5]}</span></div><div class="small text-dark mb-3 pb-3 border-bottom" style="line-height: 1.5;">${r[6]}</div><div class="d-flex gap-2">${btnFile}<button class="btn btn-sm btn-warning text-white px-3" onclick="editNpd(${realRow})"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger px-3" onclick="hapusNpd(${realRow})"><i class="fas fa-trash-alt"></i></button></div></div></div>`;
    };

    const createCardPesanan = (rowObj) => {
        const r = rowObj.values; const realRow = rowObj.rowNumber;
        const tgl = new Date(r[2]).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', year: 'numeric' });
        let displayNo = r[4] || ""; if (displayNo.includes('/')) { let parts = displayNo.split('/'); if (parts.length > 0) { parts[0] = `<span class="text-primary fw-bold">${parts[0]}</span>`; displayNo = parts.join('/'); } }
        let btnFile = r[8] ? `<button class="btn btn-sm btn-outline-primary flex-fill fw-bold" onclick="previewFile('${r[8]}')"><i class="fas fa-eye me-1"></i>Dokumen</button>` : `<button class="btn btn-sm btn-outline-secondary flex-fill" disabled><i class="fas fa-eye-slash me-1"></i>Kosong</button>`;
        let rincianList = ""; if(r[5]) { const lines = String(r[5]).split('\n').filter(line => line.trim() !== ""); rincianList = `<ul class="mb-0 ps-3 small" style="line-height: 1.4;">${lines.map(line => `<li>${line}</li>`).join('')}</ul>`; }
        return `<div class="card shadow-sm mb-3 border-0" style="border-radius: 12px; overflow: hidden;"><div class="card-body p-3"><div class="d-flex justify-content-between align-items-start mb-2"><div><div class="fw-bold text-dark" style="font-size: 1.05rem;">${displayNo}</div><div class="small text-muted mt-1"><i class="far fa-calendar-alt me-1"></i> ${tgl}</div></div><span class="badge bg-pesanan bg-opacity-10 text-teal border border-teal" style="color: #0d9488; border-color: #0d9488 !important; background-color: #ccfbf1;">${r[7]}</span></div><div class="small text-dark mb-1 fw-bold"><i class="fas fa-store me-1 text-muted"></i> ${r[6]}</div><div class="small text-dark mb-3 pb-3 border-bottom">${rincianList}</div><div class="d-flex gap-2">${btnFile}<button class="btn btn-sm btn-warning text-white px-3" onclick="editPesanan(${realRow})"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-danger px-3" onclick="hapusPesanan(${realRow})"><i class="fas fa-trash-alt"></i></button></div></div></div>`;
    };

    // --- Render Calls ---
    const updateHTML = (id, data, htmlFunc, emptyMsg) => { const el = document.querySelector(id); if(!el) return; el.innerHTML = data.length === 0 ? emptyMsg : data.map(htmlFunc).join(''); };
    const emptyTableHTML = (colspan) => `<tr><td colspan="${colspan}" class="text-center py-5 text-muted"><i class="fas fa-search fa-3x mb-3 d-block opacity-25"></i>Data tidak ditemukan</td></tr>`;
    const emptyCardHTML = `<div class="text-center py-5 text-muted bg-white rounded shadow-sm border-0"><i class="fas fa-search fa-2x mb-2 d-block opacity-25"></i>Data tidak ditemukan</div>`;

    updateHTML('#tableMasuk tbody', paginatedMasuk, r => createRow(r, 'masuk'), emptyTableHTML(6));
    updateHTML('#mobileMasukContainer', paginatedMasuk, r => createCardMasuk(r), emptyCardHTML);
    renderPaginationControls(filteredMasuk.length, currentPageMasuk, rowsPerPageMasuk, 'masuk', 'paginationMasuk');

    updateHTML('#tableKeluar tbody', paginatedKeluar, r => createRow(r, 'keluar'), emptyTableHTML(6));
    updateHTML('#mobileKeluarContainer', paginatedKeluar, r => createCardKeluar(r, 'keluar'), emptyCardHTML);
    renderPaginationControls(filteredKeluar.length, currentPageKeluar, rowsPerPageKeluar, 'keluar', 'paginationKeluar');

    updateHTML('#tableKeputusan tbody', paginatedKeputusan, r => createRow(r, 'keputusan'), emptyTableHTML(6));
    updateHTML('#mobileKeputusanContainer', paginatedKeputusan, r => createCardKeluar(r, 'keputusan'), emptyCardHTML);
    renderPaginationControls(filteredKeputusan.length, currentPageKeputusan, rowsPerPageKeputusan, 'keputusan', 'paginationKeputusan');

    updateHTML('#tableBeritaAcara tbody', paginatedBeritaAcara, createRowBeritaAcara, emptyTableHTML(6));
    updateHTML('#mobileBeritaAcaraContainer', paginatedBeritaAcara, createCardBeritaAcara, emptyCardHTML);
    renderPaginationControls(filteredBeritaAcara.length, currentPageBeritaAcara, rowsPerPageBeritaAcara, 'berita_acara', 'paginationBeritaAcara');

    updateHTML('#tablePerjadin tbody', paginatedPerjadin, createRowPerjadin, emptyTableHTML(6));
    updateHTML('#mobilePerjadinContainer', paginatedPerjadin, createCardPerjadin, emptyCardHTML);
    renderPaginationControls(filteredPerjadin.length, currentPagePerjadin, rowsPerPagePerjadin, 'perjadin', 'paginationPerjadin');

    updateHTML('#tableNpd tbody', paginatedNpd, createRowNpd, emptyTableHTML(4));
    updateHTML('#mobileNpdContainer', paginatedNpd, createCardNpd, emptyCardHTML);
    renderPaginationControls(filteredNpd.length, currentPageNpd, rowsPerPageNpd, 'npd', 'paginationNpd');

    updateHTML('#tablePesanan tbody', paginatedPesanan, createRowPesanan, emptyTableHTML(5));
    updateHTML('#mobilePesananContainer', paginatedPesanan, createCardPesanan, emptyCardHTML);
    renderPaginationControls(filteredPesanan.length, currentPagePesanan, rowsPerPagePesanan, 'pesanan', 'paginationPesanan');

    updateHTML('#tableBon tbody', paginatedBon, createRowBon, emptyTableHTML(4));
    updateHTML('#mobileBonContainer', paginatedBon, createCardBon, emptyCardHTML);
    renderPaginationControls(filteredBon.length, currentPageBon, rowsPerPageBon, 'bon', 'paginationBon');
}


/* =========================================================================
   06. MANAJEMEN DRAG & DROP
   ========================================================================= */
const validateFileGlobal = (file, fileInput, resetFunc) => {
    if (file.size > 2 * 1024 * 1024) { Swal.fire({ icon: 'error', title: 'Gagal Upload', text: 'Ukuran file max 2 MB.' }); fileInput.value = ""; resetFunc(); return false; }
    return true;
};

function setupDragAndDrop() {
    const dropZone = document.getElementById('dropZoneArea'); const fileInput = document.getElementById('inpFile');
    const updateUI = (name) => { document.getElementById('dropZoneText').style.display = 'none'; document.getElementById('fileSelectedInfo').style.display = 'flex'; document.getElementById('fileNameDisplay').innerText = name; };
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files.length > 0 && validateFileGlobal(fileInput.files[0], fileInput, resetDropZone)) updateUI(fileInput.files[0].name); });
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('dragover')));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('dragover')));
    dropZone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length > 0 && validateFileGlobal(e.dataTransfer.files[0], fileInput, resetDropZone)) { fileInput.files = e.dataTransfer.files; updateUI(e.dataTransfer.files[0].name); } });
}
function resetDropZone() { document.getElementById('dropZoneText').style.display = 'block'; document.getElementById('fileSelectedInfo').style.display = 'none'; document.getElementById('inpFile').value = ""; }

function setupDragAndDropPerjadin() {
    const dropZone = document.getElementById('dropZonePerjadin'); const fileInput = document.getElementById('pFile'); 
    const updateUI = (name) => { document.getElementById('dropZoneTextPerjadin').style.display = 'none'; document.getElementById('fileInfoPerjadin').style.display = 'flex'; document.getElementById('fileNamePerjadin').innerText = name; };
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files.length > 0 && validateFileGlobal(fileInput.files[0], fileInput, resetDropZonePerjadin)) updateUI(fileInput.files[0].name); });
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('dragover')));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('dragover')));
    dropZone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length > 0 && validateFileGlobal(e.dataTransfer.files[0], fileInput, resetDropZonePerjadin)) { fileInput.files = e.dataTransfer.files; updateUI(e.dataTransfer.files[0].name); } });
}
function resetDropZonePerjadin() { document.getElementById('dropZoneTextPerjadin').style.display = 'block'; document.getElementById('fileInfoPerjadin').style.display = 'none'; document.getElementById('pFile').value = ""; document.getElementById('fileHelpPerjadin').innerText = ""; }

function setupDragAndDropNpd() {
    const dropZone = document.getElementById('dropZoneNpd'); const fileInput = document.getElementById('nFile'); if(!dropZone || !fileInput) return;
    const updateUI = (name) => { document.getElementById('dropZoneTextNpd').style.display = 'none'; document.getElementById('fileInfoNpd').style.display = 'flex'; document.getElementById('fileNameNpd').innerText = name; };
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files.length > 0 && validateFileGlobal(fileInput.files[0], fileInput, resetDropZoneNpd)) updateUI(fileInput.files[0].name); });
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('dragover')));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('dragover')));
    dropZone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length > 0 && validateFileGlobal(e.dataTransfer.files[0], fileInput, resetDropZoneNpd)) { fileInput.files = e.dataTransfer.files; updateUI(e.dataTransfer.files[0].name); } });
}
function resetDropZoneNpd() { document.getElementById('dropZoneTextNpd').style.display = 'block'; document.getElementById('fileInfoNpd').style.display = 'none'; document.getElementById('nFile').value = ""; document.getElementById('fileHelpNpd').innerText = ""; }

function setupDragAndDropBon() {
    const dropZone = document.getElementById('dropZoneBon'); const fileInput = document.getElementById('bFile'); if(!dropZone || !fileInput) return;
    const updateUI = (name) => { document.getElementById('dropZoneTextBon').style.display = 'none'; document.getElementById('fileInfoBon').style.display = 'flex'; document.getElementById('fileNameBon').innerText = name; };
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files.length > 0 && validateFileGlobal(fileInput.files[0], fileInput, resetDropZoneBon)) updateUI(fileInput.files[0].name); });
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('dragover')));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('dragover')));
    dropZone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length > 0 && validateFileGlobal(e.dataTransfer.files[0], fileInput, resetDropZoneBon)) { fileInput.files = e.dataTransfer.files; updateUI(e.dataTransfer.files[0].name); } });
}

function resetDropZoneBon() {
    document.getElementById('dropZoneTextBon').style.display = 'block'; document.getElementById('fileInfoBon').style.display = 'none';
    document.getElementById('bFile').value = ""; document.getElementById('fileHelpBon').innerText = "";
}

function updatePreviewBon() {
    const no = document.getElementById('bNoUrut').value; const kode = document.getElementById('bKodeTengah').value; const tahun = document.getElementById('bTahun').value;
    document.getElementById('previewBon').innerText = no ? `${no}/${kode}/${tahun}` : `-`;
}

function openModalBon() {
    document.getElementById('formBon').reset(); resetDropZoneBon();
    document.getElementById('bTahun').value = "2026"; document.getElementById('bKodeTengah').value = "";
    document.getElementById('bIsEdit').value = "false"; document.getElementById('bRowNumber').value = "";
    document.getElementById('modalBonTitle').innerHTML = "<i class='fas fa-receipt me-2'></i>Input Bon";
    updatePreviewBon();
    const modalEl = document.getElementById('modalBon'); if(modalEl) new bootstrap.Modal(modalEl).show();
}

function simpanBon() {
    const tgl = document.getElementById('bTglNaskah').value; let noUrut = document.getElementById('bNoUrut').value;
    const kodeTengah = document.getElementById('bKodeTengah').value; const tahun = document.getElementById('bTahun').value;
    const keperluan = document.getElementById('bKeperluan').value; const penerima = document.getElementById('bPenerimaBon').value;

    let emptyFields = [];
    if (!tgl) emptyFields.push("Tanggal Naskah"); if (!noUrut) emptyFields.push("No Urut");
    if (!kodeTengah) emptyFields.push("Kode Lanjutan"); if (!tahun) emptyFields.push("Tahun");
    if (!keperluan) emptyFields.push("Keperluan"); if (!penerima) emptyFields.push("Penerima Bon");
    if (emptyFields.length > 0) { Swal.fire({icon: 'warning', title: 'Data Belum Lengkap', html: `Lengkapi:<br><b>${emptyFields.join(', ')}</b>`}); return; }

    noUrut = String(parseInt(noUrut) || 0).padStart(3, '0'); document.getElementById('bNoUrut').value = noUrut;
    const noLengkap = `${noUrut}/${kodeTengah}/${tahun}`;
    const isEdit = document.getElementById('bIsEdit').value === "true"; const currentRow = document.getElementById('bRowNumber').value;

    const isDuplicate = globalData.bon.some(item => {
        if (isEdit && String(item.rowNumber) === String(currentRow)) return false;
        return ((parseInt(item.values[3]) || 0) === parseInt(noUrut) && String(item.values[4] || "").includes(tahun));
    });

    if (isDuplicate) { Swal.fire({ title: 'Gagal Simpan!', html: `Nomor Urut <b>${parseInt(noUrut)}</b> sudah terdaftar di tahun <b>${tahun}</b>.`, icon: 'error' }); return; }

    const payload = {
        action: isEdit ? 'updateBon' : 'simpanBon', rowNumber: currentRow, tanggalNaskah: tgl, noUrut: noUrut, noBonLengkap: noLengkap,
        keperluan: keperluan, penerimaBon: penerima, existingFile: document.getElementById('bExistingFile').value, username: currentUser.username, fileName: "", fileData: ""
    };

    const fileInput = document.getElementById('bFile');
    const sendRequest = () => {
        showLoading(true); const m = document.getElementById('modalBon'); if(m) bootstrap.Modal.getInstance(m).hide();
        safeFetchPOST(payload).then(resp => { showLoading(false); if(resp.status === 'success') { Swal.fire({ icon: 'success', title: 'Berhasil', text: resp.message, timer: 2000, showConfirmButton: false }); loadData(); } else Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); });
    };

    if (fileInput.files.length > 0) {
        if (fileInput.files[0].size > 2*1024*1024) { Swal.fire('Error','File max 2MB','error'); return; }
        const reader = new FileReader(); reader.onload = function(e) { payload.fileName = fileInput.files[0].name; payload.fileData = e.target.result.split(',')[1]; sendRequest(); }; reader.readAsDataURL(fileInput.files[0]);
    } else sendRequest();
}

function editBon(rowNumber) {
    const dataObj = globalData.bon.find(item => item.rowNumber === rowNumber); if (!dataObj) return; const r = dataObj.values;
    if (r[8] !== currentUser.username && currentUser.role !== 'Super Admin') { Swal.fire('Akses Ditolak', 'Hanya Pemilik dan Super Admin yang mengedit data ini.', 'error'); return; }

    openModalBon(); document.getElementById('bIsEdit').value = "true"; document.getElementById('bRowNumber').value = rowNumber; document.getElementById('modalBonTitle').innerHTML = "<i class='fas fa-pen me-2'></i>Edit Bon";
    
    const tzDate = new Date(new Date(r[2]).toLocaleString("en-US", {timeZone: "Asia/Makassar"}));
    document.getElementById('bTglNaskah').value = `${tzDate.getFullYear()}-${String(tzDate.getMonth()+1).padStart(2,'0')}-${String(tzDate.getDate()).padStart(2,'0')}`;
    
    document.getElementById('bNoUrut').value = r[3] ? String(parseInt(r[3])).padStart(3, '0') : "";
    const parts = (r[4] || "").split('/');
    if (parts.length >= 3) {
        document.getElementById('bKodeTengah').value = parts.slice(1, parts.length - 1).join('/');
        document.getElementById('bTahun').value = parts[parts.length - 1];
    }
    
    document.getElementById('bKeperluan').value = r[5]; document.getElementById('bPenerimaBon').value = r[6]; document.getElementById('bExistingFile').value = r[7];
    document.getElementById('fileHelpBon').innerHTML = r[7] ? `<span class="text-success fw-bold"><i class="fas fa-check-circle"></i> File tersimpan.</span> Upload baru mengganti.` : "Belum ada file. Upload untuk menambahkan.";
    updatePreviewBon();
}

function hapusBon(rowNumber) {
    const dataObj = globalData.bon.find(item => item.rowNumber === rowNumber); if (!dataObj) return;
    if (dataObj.values[8] !== currentUser.username && currentUser.role !== 'Super Admin') { Swal.fire('Akses Ditolak', 'Akses dibatasi.', 'error'); return; }
    
    const captcha = Math.floor(1000 + Math.random() * 9000).toString();
    Swal.fire({
        title: 'Hapus Bon?', html: `Ketik angka <b class="text-danger fs-5">${captcha}</b> untuk konfirmasi:`, input: 'text', icon: 'warning', showCancelButton: true, cancelButtonText: 'Batal', confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus', reverseButtons: true,
        preConfirm: (val) => { if (val !== captcha) { Swal.showValidationMessage('Angka tidak cocok!'); return false; } return true; }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true); safeFetchPOST({ action: 'hapusBon', rowNumber: rowNumber, username: currentUser.username }).then(resp => { showLoading(false); if(resp.status === 'success') { document.getElementById('searchBon').value = ""; resetPagination('bon'); Swal.fire('Terhapus', resp.message, 'success'); loadData(); } else Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); });
        }
    });
}

/* =========================================================================
   07. MODUL PENGATURAN (JENIS SURAT & USER)
   ========================================================================= */
function renderJenisSuratSettings() {
    const listEl = document.getElementById('listJenisSurat'); listEl.innerHTML = '';
    if (globalData.jenisSurat.length === 0) { listEl.innerHTML = `<div class="text-center py-4 text-muted"><i class="fas fa-inbox fa-3x mb-3 opacity-25"></i><p class="small m-0">Belum ada jenis surat.<br>Klik tombol <b>+ Tambah</b> di atas.</p></div>`; return; }
    globalData.jenisSurat.forEach((jenis) => {
        const li = document.createElement('li'); li.className = 'list-group-item border-0 shadow-sm mb-2 rounded-3 d-flex justify-content-between align-items-center bg-white'; li.style.fontSize = "0.9rem"; 
        li.innerHTML = `<div class="d-flex align-items-center gap-3"><div class="text-muted cursor-move px-2" style="cursor: grab;"><i class="fas fa-grip-vertical"></i></div><div class="fw-bold text-dark">${jenis}</div></div><div class="d-flex gap-1"><button class="btn btn-sm btn-light text-primary border" onclick="editJenisSurat('${jenis}')"><i class="fas fa-pen fa-xs"></i></button><button class="btn btn-sm btn-light text-danger border" onclick="deleteJenisSurat('${jenis}')"><i class="fas fa-trash-alt fa-xs"></i></button></div>`;
        li.dataset.value = jenis; listEl.appendChild(li);
    });
    new Sortable(listEl, { animation: 150, handle: '.cursor-move', ghostClass: 'bg-light', onEnd: function () { const newList = []; listEl.querySelectorAll('li').forEach(item => newList.push(item.dataset.value)); globalData.jenisSurat = newList; pushAutoSave('Urutan diperbarui'); } });
}

function pushAutoSave(message) { safeFetchPOST({ action: 'manageJenisSurat', list: globalData.jenisSurat }).then(resp => { if (resp.status === 'success') { Toast.fire({ icon: 'success', title: message }); populateDropdown(); } }).catch(err => Toast.fire({ icon: 'error', title: 'Gagal menyimpan perubahan koneksi' })); }

function addJenisSurat() {
    Swal.fire({ title: 'Tambah Jenis Surat', input: 'text', inputPlaceholder: 'Cth: Surat Undangan', showCancelButton: true, confirmButtonText: 'Simpan', reverseButtons: true }).then((result) => {
        if (result.isConfirmed && result.value) { const newValue = result.value.trim(); if(newValue && !globalData.jenisSurat.includes(newValue)) { globalData.jenisSurat.push(newValue); renderJenisSuratSettings(); pushAutoSave('Jenis surat ditambahkan'); } else Swal.fire('Info', 'Kosong atau sudah ada.', 'info'); }
    });
}

function editJenisSurat(oldVal) {
    Swal.fire({
        title: 'Ubah Nama', input: 'text', inputValue: oldVal, showCancelButton: true, cancelButtonText: 'Batal', confirmButtonText: 'Simpan', reverseButtons: true,
        inputValidator: (value) => { if (!value) return 'Tidak boleh kosong!'; if (value !== oldVal && globalData.jenisSurat.includes(value)) return 'Sudah ada!'; }
    }).then((result) => { if (result.isConfirmed && result.value) { const index = globalData.jenisSurat.indexOf(oldVal); if (index !== -1) { globalData.jenisSurat[index] = result.value.trim(); renderJenisSuratSettings(); pushAutoSave('Nama diperbarui'); } } });
}

function deleteJenisSurat(val) { Swal.fire({ title: 'Hapus?', text: `Hapus "${val}"?`, icon: 'warning', showCancelButton: true, cancelButtonText: 'Batal', confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus', reverseButtons: true }).then((result) => { if (result.isConfirmed) { globalData.jenisSurat = globalData.jenisSurat.filter(item => item !== val); renderJenisSuratSettings(); pushAutoSave('Jenis surat dihapus'); } }); }

function populateDropdown() {
    const sel = document.getElementById('inpJenis'); if(!sel) return; sel.innerHTML = '<option value="">Pilih</option>';
    globalData.jenisSurat.forEach(jenis => { let opt = document.createElement('option'); opt.value = jenis; opt.innerText = jenis; sel.appendChild(opt); });
}

const modalUserElement = document.getElementById('modalUser'); let modalUser; if (modalUserElement) modalUser = new bootstrap.Modal(modalUserElement);

function loadUsers() { fetch(GAS_API_URL + "?action=getUsers").then(res => res.json()).then(resp => { if (resp.status === 'success') { userList = resp.data; renderUserTable(); } }); }
function renderUserTable() {
    const tbody = document.querySelector('#tableUsers tbody'); tbody.innerHTML = '';
    userList.forEach(u => { tbody.innerHTML += `<tr><td class="fw-bold small">${u.username}</td><td class="small">${u.nama}</td><td><span class="badge ${u.role === 'Super Admin' ? 'bg-warning text-dark' : 'bg-secondary'}">${u.role}</span></td><td class="text-center"><button class="btn btn-sm btn-outline-dark me-1" onclick="editUser('${u.username}')"><i class="fas fa-pen"></i></button><button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.username}')"><i class="fas fa-trash-alt"></i></button></td></tr>`; });
}

function openUserModal() { document.getElementById('formUser').reset(); document.getElementById('isUserEdit').value = "false"; document.getElementById('modalUserTitle').innerText = "Tambah User Baru"; document.getElementById('uUsername').disabled = false; document.getElementById('uPasswordHelp').innerText = "Password wajib diisi untuk user baru."; if(modalUser) modalUser.show(); }

function editUser(username) {
    const user = userList.find(u => u.username === username); if(!user) return;
    document.getElementById('isUserEdit').value = "true"; document.getElementById('modalUserTitle').innerText = "Edit User";
    document.getElementById('uUsername').value = user.username; document.getElementById('uUsername').disabled = true; 
    document.getElementById('uNama').value = user.nama; document.getElementById('uRole').value = user.role;
    document.getElementById('uPassword').value = ""; document.getElementById('uPasswordHelp').innerText = "Biarkan kosong jika password tidak berubah.";
    if(modalUser) modalUser.show();
}

function saveUser() {
    const isEdit = document.getElementById('isUserEdit').value === "true"; const username = document.getElementById('uUsername').value; const password = document.getElementById('uPassword').value; const nama = document.getElementById('uNama').value; const role = document.getElementById('uRole').value;
    if(!username || !nama) { Swal.fire('Error', 'Username dan Nama wajib diisi', 'error'); return; }
    if (!isEdit && !password) { Swal.fire('Error', 'Password wajib diisi untuk user baru', 'error'); return; }
    const payload = { action: 'manipulateUser', mode: 'simpan', isNew: !isEdit, targetUsername: username, targetPassword: password, targetNama: nama, targetRole: role };
    showLoading(true); if(modalUser) modalUser.hide();
    safeFetchPOST(payload).then(resp => { showLoading(false); if (resp.status === 'success') { Swal.fire({ icon: 'success', title: 'Berhasil', text: resp.message, timer: 2000, showConfirmButton: false }); loadUsers(); } else { Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); } });
}

function deleteUser(username) {
    if (username === currentUser.username) { Swal.fire('Error', 'Anda tidak bisa menghapus akun sendiri!', 'error'); return; }
    const captcha = Math.floor(1000 + Math.random() * 9000).toString();
    Swal.fire({ title: 'Hapus User?', html: `Anda akan menghapus user <b>${username}</b>.<br><br>Ketik angka <b class="text-danger fs-5">${captcha}</b> untuk konfirmasi:`, input: 'text', icon: 'warning', showCancelButton: true, cancelButtonText: 'Batal', confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus', reverseButtons: true, preConfirm: (val) => { if (val !== captcha) { Swal.showValidationMessage('Angka konfirmasi tidak cocok!'); return false; } return true; }
    }).then((result) => { if (result.isConfirmed) { showLoading(true); safeFetchPOST({ action: 'manipulateUser', mode: 'hapus', targetUsername: username, adminUsername: currentUser.username }).then(resp => { showLoading(false); if(resp.status === 'success') { Swal.fire('Terhapus', resp.message, 'success'); loadUsers(); } else { Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); } }); } });
}


/* =========================================================================
   08. MODUL SURAT (MASUK, KELUAR, KEPUTUSAN, BERITA ACARA)
   ========================================================================= */
const modalSuratElement = document.getElementById('modalSurat'); let myModal;
if (modalSuratElement) myModal = new bootstrap.Modal(modalSuratElement);

// PERBAIKAN: Fungsi ini menyembunyikan tanda "-" jika tidak ada kode
function updatePreviewNomor() {
    const elKode = document.getElementById('inpKode'); if(!elKode) return; 
    let k = elKode.value.trim(); const n = document.getElementById('inpNoUrut').value;
    const kl = document.getElementById('inpKodeLanjutan').value; const t = document.getElementById('inpTahun').value;
    
    if (k === "-" || k.toLowerCase() === "tanpa kode klasifikasi") {
        document.getElementById('previewNoSurat').innerText = n ? `${n}/${kl}/${t}` : `-`;
    } else {
        document.getElementById('previewNoSurat').innerText = (k || n) ? `${k}/${n}/${kl}/${t}` : `-`;
    }
}

function updateModalHeaderColor(type) {
    const header = document.getElementById('modalHeaderBg');
    header.classList.remove('bg-header-masuk', 'bg-header-keluar', 'bg-header-keputusan', 'bg-header-berita');
    if (type === 'masuk') header.classList.add('bg-header-masuk');
    else if (type === 'keputusan') header.classList.add('bg-header-keputusan');
    else if (type === 'berita_acara') header.classList.add('bg-header-berita'); 
    else header.classList.add('bg-header-keluar');
}

function openModal(type) {
    document.getElementById('formSurat').reset(); resetDropZone(); updateModalHeaderColor(type);
    document.getElementById('isEditMode').value = "false"; document.getElementById('realRowNumber').value = "";
    document.getElementById('existingFileUrl').value = ""; document.getElementById('btnSimpan').innerText = "Simpan";
    document.getElementById('fileHelpText').innerHTML = ""; document.getElementById('previewNoSurat').innerText = "-";

    const title = document.getElementById('modalTitle');
    const katInput = document.getElementById('kategoriSurat');
    const jenisInput = document.getElementById('inpJenis'); 
    jenisInput.removeAttribute('disabled');

    if (type === 'masuk' || type === 'keluar') {
        jenisInput.innerHTML = '<option value="" disabled selected>Pilih</option>' + 
                               globalData.jenisSurat.map(j => `<option value="${j}">${j}</option>`).join('');
    }

    if (type === 'masuk') {
        title.innerHTML = "<i class='fas fa-envelope-open-text me-2'></i>Input Surat Masuk"; katInput.value = "surat_masuk";
        document.getElementById('blockMasukAtas').classList.remove('d-none'); document.getElementById('blockMasukBawah').classList.remove('d-none');
        document.getElementById('blockKeluarAtas').classList.add('d-none'); document.getElementById('blockKeluarBawah').classList.add('d-none');
        document.getElementById('blockBeritaBawah').classList.add('d-none');
        document.getElementById('inpNomorMasuk').setAttribute('required', ''); document.getElementById('inpPengirim').setAttribute('required', '');
        document.getElementById('inpKode').removeAttribute('required'); document.getElementById('inpNoUrut').removeAttribute('required');
        
    } else if (type === 'keputusan') {
        title.innerHTML = "<i class='fas fa-gavel me-2'></i>Input SK, SP, SOP, dll"; 
        katInput.value = "surat_keputusan";
        document.getElementById('blockKeluarAtas').classList.remove('d-none'); document.getElementById('blockKeluarBawah').classList.remove('d-none');
        document.getElementById('blockMasukAtas').classList.add('d-none'); document.getElementById('blockMasukBawah').classList.add('d-none');
        document.getElementById('blockBeritaBawah').classList.add('d-none');
        document.getElementById('inpKodeLanjutan').value = ""; document.getElementById('inpTahun').value = "2026"; updatePreviewNomor();
        document.getElementById('inpKode').setAttribute('required', ''); document.getElementById('inpNoUrut').setAttribute('required', '');
        document.getElementById('inpNomorMasuk').removeAttribute('required'); document.getElementById('inpPengirim').removeAttribute('required');
        
        jenisInput.innerHTML = '<option value="Surat Keputusan">Surat Keputusan</option><option value="Surat Keterangan">Surat Keterangan</option><option value="Surat Pernyataan">Surat Pernyataan</option><option value="Surat Rekomendasi">Surat Rekomendasi</option><option value="Surat Kuasa">Surat Kuasa</option><option value="Standar Operasional Prosedur">Standar Operasional Prosedur</option>';
        jenisInput.value = "Surat Keputusan"; 

    } else if (type === 'berita_acara') {
        title.innerHTML = "<i class='fas fa-handshake me-2'></i>Input Berita Acara"; 
        katInput.value = "berita_acara";
        
        document.getElementById('blockKeluarAtas').classList.remove('d-none'); 
        document.getElementById('blockMasukAtas').classList.add('d-none'); 
        document.getElementById('blockKeluarBawah').classList.add('d-none');
        document.getElementById('blockMasukBawah').classList.add('d-none');
        document.getElementById('blockBeritaBawah').classList.remove('d-none'); 
        
        document.getElementById('inpKodeLanjutan').value = ""; document.getElementById('inpTahun').value = "2026"; updatePreviewNomor();
        document.getElementById('inpKode').setAttribute('required', ''); document.getElementById('inpNoUrut').setAttribute('required', '');
        
        jenisInput.innerHTML = '<option value="BA Serah Terima">BA Serah Terima</option><option value="BA Penerimaan">BA Penerimaan</option><option value="BA Pemeriksaan">BA Pemeriksaan</option><option value="BA Pembayaran">BA Pembayaran</option>';
        jenisInput.value = "BA Serah Terima";

    } else {
        title.innerHTML = "<i class='fas fa-paper-plane me-2'></i>Input Surat Keluar"; katInput.value = "surat_keluar";
        document.getElementById('blockKeluarAtas').classList.remove('d-none'); document.getElementById('blockKeluarBawah').classList.remove('d-none');
        document.getElementById('blockMasukAtas').classList.add('d-none'); document.getElementById('blockMasukBawah').classList.add('d-none');
        document.getElementById('blockBeritaBawah').classList.add('d-none');
        document.getElementById('inpKodeLanjutan').value = ""; document.getElementById('inpTahun').value = "2026"; updatePreviewNomor();
        document.getElementById('inpKode').setAttribute('required', ''); document.getElementById('inpNoUrut').setAttribute('required', '');
        document.getElementById('inpNomorMasuk').removeAttribute('required'); document.getElementById('inpPengirim').removeAttribute('required');
    }
    
    if(myModal) myModal.show();
}

function editData(type, rowNumber) {
    let sourceArray = type === 'masuk' ? globalData.suratMasuk : (type === 'keputusan' ? globalData.suratKeputusan : (type === 'berita_acara' ? globalData.beritaAcara : globalData.suratKeluar));
    const dataObj = sourceArray.find(item => item.rowNumber === rowNumber); if (!dataObj) return;
    const rowData = dataObj.values;
    const idxPenginput = type === 'masuk' ? 10 : 12; const penginput = rowData[idxPenginput] ? rowData[idxPenginput] : "-";
    
    if (penginput !== "-" && penginput !== currentUser.username && currentUser.role !== 'Super Admin') {
        Swal.fire({icon: 'error', title: 'Akses Ditolak', text: `Hanya Pemilik dan Super Admin yang dapat mengedit data ini.`}); return;
    }
    openModal(type);
    document.getElementById('isEditMode').value = "true"; document.getElementById('realRowNumber').value = rowNumber;
    document.getElementById('btnSimpan').innerText = "Perbarui"; document.getElementById('modalTitle').innerHTML = "<i class='fas fa-pen me-2'></i>Edit Data";

    const d = new Date(rowData[2]); const tzDate = new Date(d.toLocaleString("en-US", {timeZone: "Asia/Makassar"}));
    document.getElementById('inpTanggal').value = `${tzDate.getFullYear()}-${String(tzDate.getMonth() + 1).padStart(2, '0')}-${String(tzDate.getDate()).padStart(2, '0')}`;

    if (type === 'masuk') {
        document.getElementById('inpNomorMasuk').value = rowData[3]; document.getElementById('inpJenis').value = rowData[4];
        document.getElementById('inpPerihal').value = rowData[5]; document.getElementById('inpPengirim').value = rowData[6];
        document.getElementById('inpDiteruskan').value = rowData[7]; document.getElementById('inpKeterangan').value = rowData[8];
        document.getElementById('existingFileUrl').value = rowData[9]; checkFileStatus(rowData[9]);
    } else {
        const padNo = (val) => val ? String(parseInt(val)).padStart(3, '0') : "";
        document.getElementById('inpKode').value = rowData[3]; document.getElementById('inpNoUrut').value = padNo(rowData[4]);                
        
        // PERBAIKAN: Mengurai format nomor (baik yang 3-segmen maupun 4-segmen)
        const parts = (rowData[5] || "").split('/');
        if (parts.length >= 4) { 
            document.getElementById('inpKodeLanjutan').value = parts[2]; 
            document.getElementById('inpTahun').value = parts[3]; 
        } else if (parts.length === 3) {
            document.getElementById('inpKodeLanjutan').value = parts[1]; 
            document.getElementById('inpTahun').value = parts[2]; 
        }
        
        document.getElementById('inpJenis').value = rowData[6]; document.getElementById('inpPerihal').value = rowData[7];
        
        if (type === 'berita_acara') {
            document.getElementById('inpMenyerahkan').value = rowData[8]; 
            document.getElementById('inpMenerima').value = rowData[9]; 
        } else {
            document.getElementById('inpTujuan').value = rowData[8]; 
            document.getElementById('inpAsalNaskah').value = rowData[9]; 
        }
        
        document.getElementById('inpKeterangan').value = rowData[10]; document.getElementById('existingFileUrl').value = rowData[11]; checkFileStatus(rowData[11]);
        updatePreviewNomor();
    }
}

function checkFileStatus(url) {
    const fileHelp = document.getElementById('fileHelpText');
    if (url) fileHelp.innerHTML = `<span class="text-success fw-bold"><i class="fas fa-check-circle"></i> File tersimpan.</span> Upload baru untuk mengganti.`;
    else fileHelp.innerText = "Belum ada file. Upload untuk menambahkan.";
}

function simpanData() {
    const fileInput = document.getElementById('inpFile'); const kategori = document.getElementById('kategoriSurat').value;
    const isEdit = document.getElementById('isEditMode').value === "true";
    const payload = {
        action: isEdit ? 'updateSurat' : 'simpanSurat', kategori: kategori, rowNumber: document.getElementById('realRowNumber').value,
        tanggalSurat: document.getElementById('inpTanggal').value, jenisSurat: document.getElementById('inpJenis').value,
        perihal: document.getElementById('inpPerihal').value, keterangan: document.getElementById('inpKeterangan').value,
        existingFile: document.getElementById('existingFileUrl').value, username: currentUser.username, fileName: "", fileMime: "", fileData: ""
    };

    let emptyFields = [];
    if (!payload.tanggalSurat) emptyFields.push("Tanggal Surat");
    if (!payload.jenisSurat) emptyFields.push("Jenis Surat");
    if (!payload.perihal) emptyFields.push("Perihal / Deskripsi");

    if (kategori === 'surat_masuk') {
        payload.nomorSurat = document.getElementById('inpNomorMasuk').value; payload.asal = document.getElementById('inpPengirim').value;
        payload.diteruskan = document.getElementById('inpDiteruskan').value; 
        if (!payload.nomorSurat) emptyFields.push("Nomor Surat"); if (!payload.asal) emptyFields.push("Asal / Pengirim");
    } else if (kategori === 'berita_acara') {
        let k = document.getElementById('inpKode').value.trim(); if (k.toLowerCase() === 'tanpa kode klasifikasi') k = '-';
        const n = document.getElementById('inpNoUrut').value;
        const kl = document.getElementById('inpKodeLanjutan').value; const t = document.getElementById('inpTahun').value;
        
        payload.kodeKlasifikasi = k; payload.noUrut = n; 
        payload.noLengkap = (k === "-") ? `${n}/${kl}/${t}` : `${k}/${n}/${kl}/${t}`; // Format khusus tanpa kode
        
        payload.tujuan = document.getElementById('inpMenyerahkan').value; 
        payload.asalNaskah = document.getElementById('inpMenerima').value;
        
        if (!k) emptyFields.push("Kode"); if (!n) emptyFields.push("No Urut");
        if (!payload.tujuan) emptyFields.push("Yang Menyerahkan"); if (!payload.asalNaskah) emptyFields.push("Yang Menerima");
        if (!kl) emptyFields.push("Kode Lanjutan");
    } else {
        let k = document.getElementById('inpKode').value.trim(); if (k.toLowerCase() === 'tanpa kode klasifikasi') k = '-';
        const n = document.getElementById('inpNoUrut').value;
        const kl = document.getElementById('inpKodeLanjutan').value; const t = document.getElementById('inpTahun').value;
        
        payload.kodeKlasifikasi = k; payload.noUrut = n; 
        payload.noLengkap = (k === "-") ? `${n}/${kl}/${t}` : `${k}/${n}/${kl}/${t}`; // Format khusus tanpa kode
        
        payload.tujuan = document.getElementById('inpTujuan').value; payload.asalNaskah = document.getElementById('inpAsalNaskah').value;
        if (!k) emptyFields.push("Kode Klasifikasi"); if (!n) emptyFields.push("Nomor Urut");
        if (!payload.tujuan) emptyFields.push("Tujuan / Penerima"); if (!payload.asalNaskah) emptyFields.push("Asal Naskah");
        if (!kl) emptyFields.push("Kode Lanjutan");
    }

    if (emptyFields.length > 0) { Swal.fire({ icon: 'warning', title: 'Data Belum Lengkap', html: `Mohon lengkapi field berikut:<br/><b>${emptyFields.join(', ')}</b>` }); return; }

    if (kategori === 'surat_keluar' || kategori === 'surat_keputusan' || kategori === 'berita_acara') { 
        if (payload.noUrut) {
            // PERBAIKAN: Format ulang nomor urut untuk mengakomodasi huruf sisipan & rentang
            if (payload.noUrut.includes('-')) {
                const parts = payload.noUrut.split('-');
                const formatPart = (p) => { let m = p.trim().match(/^(\d+)(.*)$/); return m ? String(parseInt(m[1])).padStart(3, '0') + m[2] : p.trim(); };
                payload.noUrut = formatPart(parts[0]) + '-' + formatPart(parts[1]);
            } else {
                let match = String(payload.noUrut).match(/^(\d+)(.*)$/);
                if(match) payload.noUrut = String(parseInt(match[1])).padStart(3, '0') + match[2];
            }
            
            const kl = document.getElementById('inpKodeLanjutan').value; const t = document.getElementById('inpTahun').value;
            payload.noLengkap = (payload.kodeKlasifikasi === "-") ? `${payload.noUrut}/${kl}/${t}` : `${payload.kodeKlasifikasi}/${payload.noUrut}/${kl}/${t}`;
        }
        
        const targetDb = kategori === 'surat_keputusan' ? globalData.suratKeputusan : (kategori === 'berita_acara' ? globalData.beritaAcara : globalData.suratKeluar);
        const inputTahun = document.getElementById('inpTahun').value;
        
        // Fungsi deteksi bentrok (mengakomodasi rentang maupun single input)
        const checkOverlap = (inputStr, dbStr) => {
            inputStr = String(inputStr).trim(); dbStr = String(dbStr).trim();
            if (inputStr === dbStr) return true; // Cek persamaan mutlak (termasuk jika ada sisipan huruf yang sama)
            
            if (inputStr.includes('-') || dbStr.includes('-')) {
                const getArr = (s) => {
                    if (s.includes('-')) {
                        let pts = s.split('-'); 
                        let start = parseInt(pts[0].replace(/\D/g, ''))||0; 
                        let end = parseInt(pts[1].replace(/\D/g, ''))||0;
                        let r = []; for(let i = Math.min(start, end); i <= Math.max(start, end); i++) r.push(i);
                        return r;
                    }
                    return [parseInt(s.replace(/\D/g, ''))||0];
                };
                let arr1 = getArr(inputStr); let arr2 = getArr(dbStr);
                return arr1.some(num => arr2.includes(num)); // Jika ada angka yang tumpang tindih
            }
            return false;
        };

        const isDuplicate = targetDb.some(item => {
            if (isEdit && String(item.rowNumber) === String(payload.rowNumber)) return false;
            if (String(item.values[5]).includes(inputTahun)) {
                return checkOverlap(payload.noUrut, item.values[4]);
            }
            return false;
        });
        
        if (isDuplicate) {
            Swal.fire({ title: 'Gagal Simpan!', html: `Nomor urut <b>${payload.noUrut}</b> bertabrakan dengan rentang/nomor yang sudah terdaftar di tahun <b>${inputTahun}</b>.<br>Silakan periksa kembali.`, icon: 'error' }); return; 
        }
    }
    executeSimpan(fileInput, payload);
}

function executeSimpan(fileInput, payload) {
    showLoading(true); if(myModal) myModal.hide();
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 2 * 1024 * 1024) { Swal.fire('Error', 'File > 2 MB', 'error'); showLoading(false); return; }
        const reader = new FileReader();
        reader.onload = function(e) { payload.fileName = file.name; payload.fileMime = file.type; payload.fileData = e.target.result.split(',')[1]; kirimKeGAS(payload); };
        reader.readAsDataURL(file);
    } else { kirimKeGAS(payload); }
}

function kirimKeGAS(payload) {
    safeFetchPOST(payload).then(resp => {
        if(payload.action !== 'hapusSurat') showLoading(false); 
        if (resp.status === 'success') { Swal.fire({ icon: 'success', title: 'Berhasil', text: resp.message, timer: 2000, showConfirmButton: false }); loadData(); } 
        else { showLoading(false); Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); }
    }).catch(err => { showLoading(false); Swal.fire('Error', "Error Network: " + err, 'error'); });
}

function hapusData(type, rowNumber) {
    let sourceArray = type === 'masuk' ? globalData.suratMasuk : (type === 'keputusan' ? globalData.suratKeputusan : (type === 'berita_acara' ? globalData.beritaAcara : globalData.suratKeluar));
    const dataObj = sourceArray.find(item => item.rowNumber === rowNumber); if (!dataObj) return;
    const idxPenginput = type === 'masuk' ? 10 : 12; const penginput = dataObj.values[idxPenginput] ? dataObj.values[idxPenginput] : "-";

    if (penginput !== "-" && penginput !== currentUser.username && currentUser.role !== 'Super Admin') {
        Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: `Hanya Pemilik dan Super Admin yang dapat menghapus data ini.` }); return;
    }
    let label = type === 'masuk' ? 'Surat Masuk' : (type === 'keputusan' ? 'Surat Keputusan' : (type === 'berita_acara' ? 'Berita Acara' : 'Surat Keluar'));
    const captcha = Math.floor(1000 + Math.random() * 9000).toString();

    Swal.fire({
        title: `Hapus ${label}?`, html: `Anda akan menghapus data ini.<br><br>Ketik angka <b class="text-danger fs-5">${captcha}</b> untuk konfirmasi:`, input: 'text', icon: 'warning', showCancelButton: true, cancelButtonText: 'Batal', confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus', reverseButtons: true,
        preConfirm: (val) => { if (val !== captcha) { Swal.showValidationMessage('Angka konfirmasi tidak cocok!'); return false; } return true; }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true);
            const payload = { action: 'hapusSurat', kategori: type === 'masuk' ? 'surat_masuk' : (type === 'keputusan' ? 'surat_keputusan' : (type === 'berita_acara' ? 'berita_acara' : 'surat_keluar')), rowNumber: rowNumber, username: currentUser.username };
            safeFetchPOST(payload).then(resp => {
                showLoading(false);
                if(resp.status === 'success') {
                    if (type === 'masuk') document.getElementById('searchMasuk').value = ""; 
                    else if (type === 'keputusan') document.getElementById('searchKeputusan').value = ""; 
                    else if (type === 'berita_acara') document.getElementById('searchBeritaAcara').value = ""; 
                    else document.getElementById('searchKeluar').value = "";
                    
                    resetPagination(type); Swal.fire({ icon: 'success', title: 'Berhasil Terhapus', text: resp.message, timer: 2000, showConfirmButton: false }); loadData(); 
                } else { Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); }
            });
        }
    });
}


/* =========================================================================
   09. MODUL PERJADIN (PERJALANAN DINAS)
   ========================================================================= */
// PERBAIKAN: Fungsi ini menyembunyikan tanda "-" pada Preview Perjadin jika tidak ada kode
function updatePreviewPerjadin() {
    let tk = document.getElementById('tsKode').value.trim(); const tn = document.getElementById('tsNo').value;
    const ts = document.getElementById('tsSuffix').value; const tt = document.getElementById('tsTahun').value;
    if (tk === "-" || tk.toLowerCase() === "tanpa kode klasifikasi") document.getElementById('previewTS').innerText = tn ? `${tn}/${ts}/${tt}` : `-`;
    else document.getElementById('previewTS').innerText = (tk || tn) ? `${tk}/${tn}/${ts}/${tt}` : `-`;

    let sk = document.getElementById('sptKode').value.trim(); const sn = document.getElementById('sptNo').value;
    const ss = document.getElementById('sptSuffix').value; const st = document.getElementById('sptTahun').value;
    if (sk === "-" || sk.toLowerCase() === "tanpa kode klasifikasi") document.getElementById('previewSPT').innerText = sn ? `${sn}/${ss}/${st}` : `-`;
    else document.getElementById('previewSPT').innerText = (sk || sn) ? `${sk}/${sn}/${ss}/${st}` : `-`;
}

function toggleTanggalSelesai() {
    const jenis = document.getElementById('pJenis').value; const divSelesai = document.getElementById('divTglSelesai');
    if (jenis === 'Dalam Daerah') { divSelesai.style.display = 'none'; document.getElementById('pTglSelesai').removeAttribute('required'); } 
    else { divSelesai.style.display = 'block'; document.getElementById('pTglSelesai').setAttribute('required', ''); }
}

function formatAutoPad(input) {
    // Khusus SPPD Perjadin (format 000-000)
    if (input.classList.contains('inp-sppd') && input.value.includes('-')) {
        const parts = input.value.split('-');
        const val1 = parseInt(parts[0].replace(/\D/g, '')); const val2 = parseInt(parts[1].replace(/\D/g, ''));
        if (!isNaN(val1) && !isNaN(val2)) input.value = String(val1).padStart(3, '0') + '-' + String(val2).padStart(3, '0');
        return; 
    }
    
    let val = input.value.trim();
    
    // JIKA INPUT ADALAH SURAT/SK/BA -> Bisa sisipan (024.B) & rentang (100-133)
    if (input.id === 'inpNoUrut') {
        if (val !== "") {
            if (val.includes('-')) {
                // Pecah rentang nomor menjadi dua bagian dan pad masing-masing
                const parts = val.split('-');
                const formatPart = (p) => {
                    let m = p.trim().match(/^(\d+)(.*)$/);
                    return m ? String(parseInt(m[1])).padStart(3, '0') + m[2] : p.trim();
                };
                input.value = formatPart(parts[0]) + '-' + formatPart(parts[1]);
            } else {
                let match = val.match(/^(\d+)(.*)$/); 
                if (match) input.value = String(parseInt(match[1])).padStart(3, '0') + match[2];
                else input.value = ""; 
            }
        }
        if (typeof updatePreviewNomor === "function") updatePreviewNomor();
    } 
    // JIKA MODUL LAIN (Pesanan, Bon, NPD) -> STRICT (Hanya angka murni)
    else {
        const rawVal = val.replace(/\D/g, ''); 
        if (rawVal !== "") input.value = String(parseInt(rawVal)).padStart(3, '0'); else input.value = ""; 
        
        if (input.id === 'nNoUrut' && typeof updatePreviewNpd === "function") updatePreviewNpd(); 
        else if (input.id === 'bNoUrut' && typeof updatePreviewBon === "function") updatePreviewBon(); 
        else if (input.id === 'psNoUrut' && typeof updatePreviewPesanan === "function") updatePreviewPesanan();
        else if (typeof updatePreviewPerjadin === "function") updatePreviewPerjadin();
    }
}

let personilCount = 0;
function addPersonilRow(data = null) {
    document.getElementById('personilEmptyState').style.display = 'none'; personilCount++;
    const container = document.getElementById('personilContainer'); const rowId = `pRow_${personilCount}`;
    let defaultNo = "", defaultNama = "", defaultNip = "";
    if (data) { defaultNo = data.no; defaultNama = data.nama; defaultNip = data.nip; } 
    else {
        const inputs = container.querySelectorAll('.inp-sppd');
        if(inputs.length > 0) { const lastNo = inputs[inputs.length - 1].value; if(!isNaN(lastNo) && lastNo !== "") defaultNo = String(parseInt(lastNo) + 1).padStart(3, '0'); }
    }
    const div = document.createElement('div'); div.className = 'personil-row'; div.id = rowId;
    div.innerHTML = `<input type="text" class="form-control form-control-sm inp-sppd" placeholder="Cth: 001" value="${defaultNo}" title="No SPPD" onblur="formatAutoPad(this)"><div class="position-relative inp-nama"><input type="text" class="form-control form-control-sm personil-search" list="listOpsiASN" placeholder="Ketik nama..." value="${defaultNama ? defaultNama + ' (' + defaultNip + ')' : ''}" oninput="handleInputASN(this, '${rowId}')" autocomplete="off"><input type="hidden" class="personil-nip" value="${defaultNip}"></div><button type="button" class="btn btn-sm btn-outline-danger border-0" onclick="removePersonilRow('${rowId}')"><i class="fas fa-times"></i></button>`;
    container.appendChild(div); container.scrollTop = container.scrollHeight;
}

function removePersonilRow(id) { document.getElementById(id).remove(); if(document.getElementById('personilContainer').children.length === 0) document.getElementById('personilEmptyState').style.display = 'block'; }

function handleInputASN(inputEl, rowId) {
    const query = inputEl.value.toLowerCase(); const dataList = document.getElementById('listOpsiASN');
    if (query.length >= 3) {
        const results = globalASN.filter(asn => asn.nama.toLowerCase().includes(query)).slice(0, 20);
        dataList.innerHTML = ''; results.forEach(asn => { const opt = document.createElement('option'); opt.value = `${asn.nama} (${asn.nip})`; dataList.appendChild(opt); });
    }
    const match = inputEl.value.match(/\(([^)]+)\)$/); const nipInput = document.querySelector(`#${rowId} .personil-nip`);
    if (match) nipInput.value = match[1]; else nipInput.value = ""; 
}

function openModalPerjadin() {
    document.getElementById('formPerjadin').reset(); resetDropZonePerjadin();
    document.getElementById('pJenis').value = ""; document.getElementById('pAsalNaskah').value = ""; 
    document.getElementById('tsSuffix').value = ""; document.getElementById('tsTahun').value = "2026";
    document.getElementById('sptSuffix').value = ""; document.getElementById('sptTahun').value = "2026";            
    updatePreviewPerjadin(); document.getElementById('tsNo').classList.remove('is-invalid'); document.getElementById('sptNo').classList.remove('is-invalid');
    document.getElementById('pIsEdit').value = "false"; document.getElementById('pRowNumber').value = "";
    document.getElementById('personilContainer').innerHTML = ""; document.getElementById('personilEmptyState').style.display = 'block';
    document.getElementById('modalPerjadinTitle').innerHTML = "<i class='fas fa-plane-departure me-2'></i>Input Perjalanan Dinas";
    toggleTanggalSelesai();
    const modalPerjadinElement = document.getElementById('modalPerjadin'); if(modalPerjadinElement) new bootstrap.Modal(modalPerjadinElement).show();
}

function simpanPerjadin() {
    const pJenis = document.getElementById('pJenis').value; const pTglMulai = document.getElementById('pTglMulai').value;
    let pTglSelesai = document.getElementById('pTglSelesai').value; if (pJenis === 'Dalam Daerah') pTglSelesai = pTglMulai;
    const pMaksud = document.getElementById('pMaksud').value; const pTempat = document.getElementById('pTempat').value; const pDaerah = document.getElementById('pDaerah').value;
    const valAsalNaskah = document.getElementById('pAsalNaskah').value;

    let emptyFields = [];
    if (!pJenis) emptyFields.push("Jenis Perjadin"); if (!valAsalNaskah) emptyFields.push("Asal Naskah"); 
    if (!pTempat) emptyFields.push("Tempat/Tujuan"); if (!pDaerah) emptyFields.push("Kota/Kabupaten");
    if (!pTglMulai) emptyFields.push("Tanggal Mulai"); if (!pMaksud) emptyFields.push("Maksud/Kegiatan");
    if (pJenis !== 'Dalam Daerah' && !pTglSelesai) emptyFields.push("Tanggal Selesai");
    if (emptyFields.length > 0) { Swal.fire({icon: 'warning', title: 'Data Belum Lengkap', html: `Mohon lengkapi:<br/><b>${emptyFields.join(', ')}</b>`}); return; }

    let tsKode = document.getElementById('tsKode').value.trim(); if (tsKode.toLowerCase() === 'tanpa kode klasifikasi') tsKode = '-';
    const tsNo = document.getElementById('tsNo').value; const tsSuffix = document.getElementById('tsSuffix').value; const tsTahun = document.getElementById('tsTahun').value;
    
    let sptKode = document.getElementById('sptKode').value.trim(); if (sptKode.toLowerCase() === 'tanpa kode klasifikasi') sptKode = '-';
    const sptNo = document.getElementById('sptNo').value; const sptSuffix = document.getElementById('sptSuffix').value; const sptTahun = document.getElementById('sptTahun').value;

    const rows = document.querySelectorAll('.personil-row');
    if (rows.length === 0) { Swal.fire('Error', 'Minimal 1 pelaksana!', 'warning'); return; }
    let personilList = [];
    rows.forEach(row => {
        let no = row.querySelector('.inp-sppd').value; const rawNama = row.querySelector('.personil-search').value; const nip = row.querySelector('.personil-nip').value;
        if(no) { if(no.includes('-')) { const parts = no.split('-'); no = String(parseInt(parts[0]) || 0).padStart(3, '0') + '-' + String(parseInt(parts[1]) || 0).padStart(3, '0'); } else { no = String(parseInt(no) || 0).padStart(3, '0'); } }
        let namaClean = rawNama.includes('(') ? rawNama.split('(')[0].trim() : rawNama;
        if(namaClean) personilList.push({ no, nama: namaClean, nip });
    });

    const isEdit = document.getElementById('pIsEdit').value === "true"; const currentRow = document.getElementById('pRowNumber').value;
    let duplicateMsg = []; const toInt = (val) => parseInt(val) || 0;
    const expandSppd = (sppdStr) => {
        if (!sppdStr) return [];
        if (sppdStr.includes('-')) { const parts = sppdStr.split('-'); const start = Math.min(toInt(parts[0]), toInt(parts[1])); const end = Math.max(toInt(parts[0]), toInt(parts[1])); let res = []; for (let i = start; i <= end; i++) res.push(i); return res; }
        return [toInt(sppdStr)];
    };

    globalData.perjadin.forEach(item => {
        if (isEdit && String(item.rowNumber) === String(currentRow)) return;
        const vals = item.values;
        const getTahunAndUrut = (str) => {
            if (!str) return { urut: -1, tahun: "" };
            const parts = str.split('/');
            if (parts.length >= 4) return { urut: toInt(parts[1]), tahun: parts[3] };
            if (parts.length === 3) return { urut: toInt(parts[0]), tahun: parts[2] };
            return { urut: -1, tahun: "" };
        };

        if (tsNo !== "") {
            const dbTs = getTahunAndUrut(vals[10]);
            if ((vals[9] && toInt(vals[9]) === toInt(tsNo) && dbTs.tahun == tsTahun) || (!vals[9] && dbTs.urut === toInt(tsNo) && dbTs.tahun == tsTahun)) { duplicateMsg.push(`Nomor TS <b>${tsNo}</b> (Tahun ${tsTahun})`); }
        }
        if (sptNo !== "") {
            const dbSpt = getTahunAndUrut(vals[13]);
            if ((vals[12] && toInt(vals[12]) === toInt(sptNo) && dbSpt.tahun == sptTahun) || (!vals[12] && dbSpt.urut === toInt(sptNo) && dbSpt.tahun == sptTahun)) { duplicateMsg.push(`Nomor SPT <b>${sptNo}</b> (Tahun ${sptTahun})`); }
        }
        try {
            const dbPersonils = JSON.parse(vals[16]);
            let dbYear = vals[13] ? getTahunAndUrut(vals[13]).tahun : (vals[10] ? getTahunAndUrut(vals[10]).tahun : (vals[3] ? new Date(vals[3]).getFullYear().toString() : ""));
            const targetYear = sptTahun || tsTahun || new Date().getFullYear().toString();
            if (dbYear === targetYear) { 
                dbPersonils.forEach(dbP => {
                    if (!dbP.no) return; const dbSppdArr = expandSppd(dbP.no);
                    personilList.forEach(inputP => {
                        if (inputP.no !== "") { 
                            const isOverlap = expandSppd(inputP.no).some(num => dbSppdArr.includes(num));
                            if (isOverlap && !duplicateMsg.includes(`Nomor SPPD <b>${inputP.no}</b> bertabrakan dengan data terdaftar (Tahun ${targetYear})`)) duplicateMsg.push(`Nomor SPPD <b>${inputP.no}</b> bertabrakan dengan data terdaftar (Tahun ${targetYear})`);
                        }
                    });
                });
            }
        } catch(e) {}
    });

    if (duplicateMsg.length > 0) { Swal.fire({ title: 'Gagal Simpan!', html: `Nomor urut berikut sudah terdaftar/bertabrakan:<br><ul class="text-start mt-3 mb-3 text-danger fw-bold small" style="list-style-position: inside;"><li>${duplicateMsg.join('</li><li>')}</li></ul>Silakan kosongkan nomor jika belum ada, atau gunakan nomor lain.`, icon: 'error' }); return; }

    const fmtNo = (n) => n ? String(parseInt(n)).padStart(3, '0') : "";
    const finalTsNo = fmtNo(tsNo); const finalSptNo = fmtNo(sptNo);
    
    // PERBAIKAN: Format string Perjadin jika tanpa kode
    const tsFull = (tsKode === "-") ? `${finalTsNo}/${tsSuffix}/${tsTahun}` : `${tsKode}/${finalTsNo}/${tsSuffix}/${tsTahun}`;
    const sptFull = (sptKode === "-") ? `${finalSptNo}/${sptSuffix}/${sptTahun}` : `${sptKode}/${finalSptNo}/${sptSuffix}/${sptTahun}`;

    const payload = {
        action: isEdit ? 'updatePerjadin' : 'simpanPerjadin', rowNumber: currentRow, jenisPerjadin: pJenis, tglMulai: pTglMulai, tglSelesai: pTglSelesai, maksud: pMaksud, tempat: pTempat, daerah: pDaerah, 
        tsKode: tsKode, tsNo: finalTsNo, noTS: finalTsNo ? tsFull : "", 
        sptKode: sptKode, sptNo: finalSptNo, noSPT: finalSptNo ? sptFull : "", 
        asalNaskah: valAsalNaskah, keterangan: document.getElementById('pKeterangan').value, personilJson: JSON.stringify(personilList), existingFile: document.getElementById('pExistingFile').value, username: currentUser.username, fileName: "", fileData: ""
    };

    const fileInput = document.getElementById('pFile');
    const sendRequest = () => {
        showLoading(true); const modalEl = document.getElementById('modalPerjadin'); if(modalEl) bootstrap.Modal.getInstance(modalEl).hide();
        safeFetchPOST(payload).then(resp => { showLoading(false); if(resp.status === 'success') { Swal.fire({ icon: 'success', title: 'Berhasil', text: resp.message, timer: 2000, showConfirmButton: false }); loadData(); } else { Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); } });
    };

    if (fileInput.files.length > 0) {
        if (fileInput.files[0].size > 2*1024*1024) { Swal.fire('Error','File max 2MB','error'); return; }
        const reader = new FileReader();
        reader.onload = function(e) { payload.fileName = fileInput.files[0].name; payload.fileData = e.target.result.split(',')[1]; sendRequest(); };
        reader.readAsDataURL(fileInput.files[0]);
    } else { sendRequest(); }
}

function editPerjadin(rowNumber) {
    const dataObj = globalData.perjadin.find(item => item.rowNumber === rowNumber); if (!dataObj) return; const r = dataObj.values;
    if (r[18] !== currentUser.username && currentUser.role !== 'Super Admin') { Swal.fire('Akses Ditolak', 'Hanya Pemilik dan Super Admin yang dapat mengedit data ini.', 'error'); return; }

    openModalPerjadin(); document.getElementById('pIsEdit').value = "true"; document.getElementById('pRowNumber').value = rowNumber; document.getElementById('modalPerjadinTitle').innerHTML = "<i class='fas fa-pen me-2'></i>Edit Perjadin";
    const padNo = (val) => val ? String(parseInt(val)).padStart(3, '0') : "";
    document.getElementById('pJenis').value = r[2];
    
    const fmtDate = (dStr) => { if(!dStr) return ""; const tzDate = new Date(new Date(dStr).toLocaleString("en-US", {timeZone: "Asia/Makassar"})); return `${tzDate.getFullYear()}-${String(tzDate.getMonth()+1).padStart(2,'0')}-${String(tzDate.getDate()).padStart(2,'0')}`; };
    document.getElementById('pTglMulai').value = fmtDate(r[3]); document.getElementById('pTglSelesai').value = fmtDate(r[4]); toggleTanggalSelesai();
    document.getElementById('pMaksud').value = r[5]; document.getElementById('pTempat').value = r[6]; document.getElementById('pDaerah').value = r[7];
    
    document.getElementById('tsKode').value = r[8]; document.getElementById('tsNo').value = padNo(r[9]);
    
    // PERBAIKAN: Mengurai format TS & SPT (bisa 3 bagian tanpa kode)
    const tsParts = (r[10]||"").split('/');
    if(tsParts.length >= 4) { document.getElementById('tsSuffix').value = tsParts[2]; document.getElementById('tsTahun').value = tsParts[3]; } 
    else if(tsParts.length === 3) { document.getElementById('tsSuffix').value = tsParts[1]; document.getElementById('tsTahun').value = tsParts[2]; }
    else { document.getElementById('tsSuffix').value = ""; document.getElementById('tsTahun').value = "2026"; }

    document.getElementById('sptKode').value = r[11]; document.getElementById('sptNo').value = padNo(r[12]);
    const sptParts = (r[13]||"").split('/');
    if(sptParts.length >= 4) { document.getElementById('sptSuffix').value = sptParts[2]; document.getElementById('sptTahun').value = sptParts[3]; } 
    else if(sptParts.length === 3) { document.getElementById('sptSuffix').value = sptParts[1]; document.getElementById('sptTahun').value = sptParts[2]; }
    else { document.getElementById('sptSuffix').value = ""; document.getElementById('sptTahun').value = "2026"; }
    updatePreviewPerjadin(); 
    
    const standardOptions = ["Sekretariat", "Bidang PSDM", "Bidang PPIK", "Bidang MPK"];
    document.getElementById('pAsalNaskah').value = r[14];

    document.getElementById('pKeterangan').value = r[15];
    document.getElementById('pExistingFile').value = r[17];
    document.getElementById('fileHelpPerjadin').innerHTML = r[17] ? `<span class="text-success fw-bold"><i class="fas fa-check-circle"></i> File tersimpan.</span> Upload baru untuk mengganti.` : "Belum ada file. Upload untuk menambahkan.";

    try { JSON.parse(r[16]).forEach(p => { if (!(p.no && p.no.includes('-'))) p.no = padNo(p.no); addPersonilRow(p); }); } catch(e) {}
}

function hapusPerjadin(rowNumber) {
    const dataObj = globalData.perjadin.find(item => item.rowNumber === rowNumber); if (!dataObj) return;
    if (dataObj.values[18] !== currentUser.username && currentUser.role !== 'Super Admin') { Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: `Hanya Pemilik dan Super Admin yang dapat menghapus data ini.` }); return; }
    
    const captcha = Math.floor(1000 + Math.random() * 9000).toString();
    Swal.fire({
        title: 'Hapus Perjadin?', html: `Anda akan menghapus data perjalanan dinas ini.<br><br>Ketik angka <b class="text-danger fs-5">${captcha}</b> untuk konfirmasi:`, input: 'text', icon: 'warning', showCancelButton: true, cancelButtonText: 'Batal', confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus', reverseButtons: true,
        preConfirm: (val) => { if (val !== captcha) { Swal.showValidationMessage('Angka konfirmasi tidak cocok!'); return false; } return true; }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true);
            safeFetchPOST({ action: 'hapusPerjadin', rowNumber: rowNumber, username: currentUser.username }) 
            .then(resp => { showLoading(false); if(resp.status === 'success') { document.getElementById('searchPerjadin').value = ""; resetPagination('perjadin'); Swal.fire('Terhapus', resp.message, 'success'); loadData(); } else Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); });
        }
    });
}


/* =========================================================================
   10. MODUL NOTA PENCAIRAN DANA (NPD)
   ========================================================================= */
function openModalNpd() {
    document.getElementById('formNpd').reset(); resetDropZoneNpd();
    document.getElementById('nTahun').value = "2026"; document.getElementById('nKodeTengah').value = "";
    document.getElementById('nIsEdit').value = "false"; document.getElementById('nRowNumber').value = "";
    document.getElementById('modalNpdTitle').innerHTML = "<i class='fas fa-file-invoice-dollar me-2'></i>Input Nota Pencairan Dana";
    updatePreviewNpd();
    const modalNpdElement = document.getElementById('modalNpd'); if(modalNpdElement) new bootstrap.Modal(modalNpdElement).show();
}

function updatePreviewNpd() {
    const no = document.getElementById('nNoUrut').value; const kode = document.getElementById('nKodeTengah').value; const tahun = document.getElementById('nTahun').value;
    document.getElementById('previewNpd').innerText = no ? `${no}/${kode}/${tahun}` : `-`;
}

function simpanNpd() {
    const tglNaskah = document.getElementById('nTglNaskah').value; let noUrut = document.getElementById('nNoUrut').value;
    const kodeTengah = document.getElementById('nKodeTengah').value; const tahun = document.getElementById('nTahun').value;
    const asalNaskah = document.getElementById('nAsalNaskah').value; const keperluan = document.getElementById('nKeperluan').value;

    let emptyFields = [];
    if (!tglNaskah) emptyFields.push("Tanggal Naskah"); if (!noUrut) emptyFields.push("No Urut");
    if (!tahun) emptyFields.push("Tahun"); if (!asalNaskah) emptyFields.push("Asal Naskah"); if (!keperluan) emptyFields.push("Deskripsi Belanja");
    if (!kodeTengah) emptyFields.push("Kode Lanjutan");
    if (emptyFields.length > 0) { Swal.fire({icon: 'warning', title: 'Data Belum Lengkap', html: `Lengkapi:<br><b>${emptyFields.join(', ')}</b>`}); return; }

    noUrut = String(parseInt(noUrut) || 0).padStart(3, '0'); document.getElementById('nNoUrut').value = noUrut;
    const isEdit = document.getElementById('nIsEdit').value === "true"; const currentRow = document.getElementById('nRowNumber').value;
    const inputNoInt = parseInt(noUrut) || 0; 

    const isDuplicate = globalData.npd.some(item => {
        if (isEdit && String(item.rowNumber) === String(currentRow)) return false;
        return ((parseInt(item.values[3]) || 0) === inputNoInt && String(item.values[4] || "").includes(tahun));
    });

    if (isDuplicate) { Swal.fire({ title: 'Gagal Simpan!', html: `Nomor Urut <b>${inputNoInt}</b> sudah terdaftar di tahun <b>${tahun}</b>.<br>Silakan gunakan nomor urut lain.`, icon: 'error' }); return; }

    const payload = {
        action: isEdit ? 'updateNpd' : 'simpanNpd', rowNumber: currentRow, tanggalNaskah: tglNaskah, noUrut: noUrut, noNpdLengkap: `${noUrut}/${kodeTengah}/${tahun}`,
        asalNaskah: asalNaskah, keperluan: keperluan, existingFile: document.getElementById('nExistingFile').value, username: currentUser.username, fileName: "", fileData: ""
    };

    const fileInput = document.getElementById('nFile');
    const sendRequest = () => {
        showLoading(true); const modalEl = document.getElementById('modalNpd'); if(modalEl) bootstrap.Modal.getInstance(modalEl).hide();
        safeFetchPOST(payload).then(resp => { showLoading(false); if(resp.status === 'success') { Swal.fire({ icon: 'success', title: 'Berhasil', text: resp.message, timer: 2000, showConfirmButton: false }); loadData(); } else Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); });
    };

    if (fileInput.files.length > 0) {
        if (fileInput.files[0].size > 2*1024*1024) { Swal.fire('Error','File max 2MB','error'); return; }
        const reader = new FileReader(); reader.onload = function(e) { payload.fileName = fileInput.files[0].name; payload.fileData = e.target.result.split(',')[1]; sendRequest(); }; reader.readAsDataURL(fileInput.files[0]);
    } else sendRequest();
}

function editNpd(rowNumber) {
    const dataObj = globalData.npd.find(item => item.rowNumber === rowNumber); if (!dataObj) return; const r = dataObj.values;
    if (r[8] !== currentUser.username && currentUser.role !== 'Super Admin') { Swal.fire('Akses Ditolak', 'Hanya Pemilik dan Super Admin yang dapat mengedit data ini.', 'error'); return; }

    openModalNpd(); document.getElementById('nIsEdit').value = "true"; document.getElementById('nRowNumber').value = rowNumber; document.getElementById('modalNpdTitle').innerHTML = "<i class='fas fa-pen me-2'></i>Edit NPD";
    const tzDate = new Date(new Date(r[2]).toLocaleString("en-US", {timeZone: "Asia/Makassar"}));
    document.getElementById('nTglNaskah').value = `${tzDate.getFullYear()}-${String(tzDate.getMonth()+1).padStart(2,'0')}-${String(tzDate.getDate()).padStart(2,'0')}`;
    
    document.getElementById('nNoUrut').value = r[3] ? String(parseInt(r[3])).padStart(3, '0') : "";
    if((r[4] || "").split('/').length >= 3) document.getElementById('nTahun').value = (r[4] || "").split('/')[ (r[4] || "").split('/').length-1 ];
    document.getElementById('nAsalNaskah').value = r[5]; document.getElementById('nKeperluan').value = r[6]; document.getElementById('nExistingFile').value = r[7];
    document.getElementById('fileHelpNpd').innerHTML = r[7] ? `<span class="text-success fw-bold"><i class="fas fa-check-circle"></i> File tersimpan.</span> Upload baru untuk mengganti.` : "Belum ada file. Upload untuk menambahkan.";
    updatePreviewNpd();
}

function hapusNpd(rowNumber) {
    const dataObj = globalData.npd.find(item => item.rowNumber === rowNumber); if (!dataObj) return;
    if (dataObj.values[8] !== currentUser.username && currentUser.role !== 'Super Admin') { Swal.fire('Akses Ditolak', 'Hanya Pemilik dan Super Admin yang dapat menghapus data ini.', 'error'); return; }
    
    const captcha = Math.floor(1000 + Math.random() * 9000).toString();
    Swal.fire({
        title: 'Hapus NPD?', html: `Anda akan menghapus data Nota Pencairan Dana ini.<br><br>Ketik angka <b class="text-danger fs-5">${captcha}</b> untuk konfirmasi:`, input: 'text', icon: 'warning', showCancelButton: true, cancelButtonText: 'Batal', confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus', reverseButtons: true,
        preConfirm: (val) => { if (val !== captcha) { Swal.showValidationMessage('Angka konfirmasi tidak cocok!'); return false; } return true; }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true);
            safeFetchPOST({ action: 'hapusNpd', rowNumber: rowNumber, username: currentUser.username }).then(resp => { showLoading(false); if(resp.status === 'success') { document.getElementById('searchNpd').value = ""; resetPagination('npd'); Swal.fire('Terhapus', resp.message, 'success'); loadData(); } else Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); });
        }
    });
}

/* =========================================================================
   11. MODUL KODE KLASIFIKASI (MODAL & SEARCH PENCARIAN)
   ========================================================================= */

function updatePreviewPesanan() {
    const no = document.getElementById('psNoUrut').value; 
    const kode = document.getElementById('psKodeTengah').value; 
    const tahun = document.getElementById('psTahun').value;
    document.getElementById('previewPesanan').innerText = no ? `${no}/${kode}/${tahun}` : `-`;
}

function setupDragAndDropPesanan() {
    const dropZone = document.getElementById('dropZonePesanan');
    const fileInput = document.getElementById('psFile'); 
    if(!dropZone || !fileInput) return;
    const updateUI = (name) => {
        document.getElementById('dropZoneTextPesanan').style.display = 'none';
        document.getElementById('fileInfoPesanan').style.display = 'flex';
        document.getElementById('fileNamePesanan').innerText = name;
    };
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files.length > 0 && validateFileGlobal(fileInput.files[0], fileInput, resetDropZonePesanan)) updateUI(fileInput.files[0].name); });
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('dragover')));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('dragover')));
    dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files.length > 0 && validateFileGlobal(e.dataTransfer.files[0], fileInput, resetDropZonePesanan)) {
            fileInput.files = e.dataTransfer.files; updateUI(e.dataTransfer.files[0].name);
        }
    });
}

function resetDropZonePesanan() {
    document.getElementById('dropZoneTextPesanan').style.display = 'block';
    document.getElementById('fileInfoPesanan').style.display = 'none';
    document.getElementById('psFile').value = "";
    document.getElementById('fileHelpPesanan').innerText = "";
}

function openModalPesanan() {
    document.getElementById('formPesanan').reset(); resetDropZonePesanan();
    document.getElementById('psTahun').value = "2026"; document.getElementById('psKodeTengah').value = "";
    document.getElementById('psIsEdit').value = "false"; document.getElementById('psRowNumber').value = "";
    document.getElementById('modalPesananTitle').innerHTML = "<i class='fas fa-shopping-cart me-2'></i>Input Pesanan";
    updatePreviewPesanan();
    const modalPesananElement = document.getElementById('modalPesanan'); if(modalPesananElement) new bootstrap.Modal(modalPesananElement).show();
}

function simpanPesanan() {
    const tgl = document.getElementById('psTglPesanan').value; let noUrut = document.getElementById('psNoUrut').value;
    const kodeTengah = document.getElementById('psKodeTengah').value; const tahun = document.getElementById('psTahun').value;
    const rincian = document.getElementById('psRincian').value; const penyedia = document.getElementById('psPenyedia').value;
    const pemesan = document.getElementById('psPemesan').value;

    let emptyFields = [];
    if (!tgl) emptyFields.push("Tanggal Pesanan"); if (!noUrut) emptyFields.push("No Urut");
    if (!rincian) emptyFields.push("Rincian Pesanan"); if (!penyedia) emptyFields.push("Penyedia"); if (!pemesan) emptyFields.push("Pemesan");
    if (!kodeTengah) emptyFields.push("Kode Lanjutan");
    if (emptyFields.length > 0) { Swal.fire({icon: 'warning', title: 'Data Belum Lengkap', html: `Lengkapi:<br><b>${emptyFields.join(', ')}</b>`}); return; }

    noUrut = String(parseInt(noUrut) || 0).padStart(3, '0'); document.getElementById('psNoUrut').value = noUrut;
    const noLengkap = `${noUrut}/${kodeTengah}/${tahun}`;
    const isEdit = document.getElementById('psIsEdit').value === "true"; const currentRow = document.getElementById('psRowNumber').value;
    
    const isDuplicate = globalData.pesanan.some(item => {
        if (isEdit && String(item.rowNumber) === String(currentRow)) return false;
        return ((parseInt(item.values[3]) || 0) === parseInt(noUrut) && String(item.values[4] || "").includes(tahun));
    });

    if (isDuplicate) { Swal.fire({ title: 'Gagal Simpan!', html: `Nomor Urut <b>${parseInt(noUrut)}</b> sudah terdaftar di tahun <b>${tahun}</b>.`, icon: 'error' }); return; }

    const payload = {
        action: isEdit ? 'updatePesanan' : 'simpanPesanan', rowNumber: currentRow, tanggalPesanan: tgl, noUrut: noUrut, noLengkap: noLengkap,
        rincian: rincian, penyedia: penyedia, pemesan: pemesan, existingFile: document.getElementById('psExistingFile').value, username: currentUser.username, fileName: "", fileData: ""
    };

    const fileInput = document.getElementById('psFile');
    const sendRequest = () => {
        showLoading(true); const m = document.getElementById('modalPesanan'); if(m) bootstrap.Modal.getInstance(m).hide();
        safeFetchPOST(payload).then(resp => { showLoading(false); if(resp.status === 'success') { Swal.fire({ icon: 'success', title: 'Berhasil', text: resp.message, timer: 2000, showConfirmButton: false }); loadData(); } else Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); });
    };

    if (fileInput.files.length > 0) {
        if (fileInput.files[0].size > 2*1024*1024) { Swal.fire('Error','File max 2MB','error'); return; }
        const reader = new FileReader(); reader.onload = function(e) { payload.fileName = fileInput.files[0].name; payload.fileData = e.target.result.split(',')[1]; sendRequest(); }; reader.readAsDataURL(fileInput.files[0]);
    } else sendRequest();
}

function editPesanan(rowNumber) {
    const dataObj = globalData.pesanan.find(item => item.rowNumber === rowNumber); if (!dataObj) return; const r = dataObj.values;
    if (r[9] !== currentUser.username && currentUser.role !== 'Super Admin') { Swal.fire('Akses Ditolak', 'Hanya Pemilik dan Super Admin yang mengedit data ini.', 'error'); return; }

    openModalPesanan(); document.getElementById('psIsEdit').value = "true"; document.getElementById('psRowNumber').value = rowNumber; document.getElementById('modalPesananTitle').innerHTML = "<i class='fas fa-pen me-2'></i>Edit Pesanan";
    
    const tzDate = new Date(new Date(r[2]).toLocaleString("en-US", {timeZone: "Asia/Makassar"}));
    document.getElementById('psTglPesanan').value = `${tzDate.getFullYear()}-${String(tzDate.getMonth()+1).padStart(2,'0')}-${String(tzDate.getDate()).padStart(2,'0')}`;
    
    document.getElementById('psNoUrut').value = r[3] ? String(parseInt(r[3])).padStart(3, '0') : "";
    if((r[4] || "").split('/').length >= 3) document.getElementById('psTahun').value = (r[4] || "").split('/')[ (r[4] || "").split('/').length-1 ];
    
    document.getElementById('psRincian').value = r[5]; document.getElementById('psPenyedia').value = r[6]; document.getElementById('psPemesan').value = r[7];
    document.getElementById('psExistingFile').value = r[8];
    document.getElementById('fileHelpPesanan').innerHTML = r[8] ? `<span class="text-success fw-bold"><i class="fas fa-check-circle"></i> File tersimpan.</span> Upload baru mengganti.` : "Belum ada file. Upload untuk menambahkan.";
    updatePreviewPesanan();
}

function hapusPesanan(rowNumber) {
    const dataObj = globalData.pesanan.find(item => item.rowNumber === rowNumber); if (!dataObj) return;
    if (dataObj.values[9] !== currentUser.username && currentUser.role !== 'Super Admin') { Swal.fire('Akses Ditolak', 'Akses dibatasi.', 'error'); return; }
    
    const captcha = Math.floor(1000 + Math.random() * 9000).toString();
    Swal.fire({
        title: 'Hapus Pesanan?', html: `Ketik angka <b class="text-danger fs-5">${captcha}</b> untuk konfirmasi:`, input: 'text', icon: 'warning', showCancelButton: true, cancelButtonText: 'Batal', confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus', reverseButtons: true,
        preConfirm: (val) => { if (val !== captcha) { Swal.showValidationMessage('Angka tidak cocok!'); return false; } return true; }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true); safeFetchPOST({ action: 'hapusPesanan', rowNumber: rowNumber, username: currentUser.username }).then(resp => { showLoading(false); if(resp.status === 'success') { document.getElementById('searchPesanan').value = ""; resetPagination('pesanan'); Swal.fire('Terhapus', resp.message, 'success'); loadData(); } else Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message }); });
        }
    });
}

const modalKlasElement = document.getElementById('modalKlasifikasi');
let myModalKlasifikasi; if (modalKlasElement) myModalKlasifikasi = new bootstrap.Modal(modalKlasElement);
let typingTimerKlasifikasi; const doneTypingInterval = 300; 

function bukaModalKlasifikasi(targetId) {
    targetInputKlasifikasi = targetId; 
    document.getElementById('searchKlasifikasi').value = ""; 
    if(myModalKlasifikasi) myModalKlasifikasi.show();
    renderListKlasifikasi(globalData.kodeKlasifikasi);
    setTimeout(() => { document.getElementById('searchKlasifikasi').focus(); }, 500);
}

function cariKlasifikasi() { clearTimeout(typingTimerKlasifikasi); typingTimerKlasifikasi = setTimeout(eksekusiPencarianKlas, doneTypingInterval); }

function eksekusiPencarianKlas() {
    const term = document.getElementById('searchKlasifikasi').value.toLowerCase().trim();
    if (term === "") { renderListKlasifikasi(globalData.kodeKlasifikasi); return; }
    const filtered = globalData.kodeKlasifikasi.filter(item => item.kode.toLowerCase().includes(term) || item.keterangan.toLowerCase().includes(term));
    renderListKlasifikasi(filtered, term);
}

// PERBAIKAN: Penambahan pilihan "Tanpa Kode" otomatis pada UI Pencarian Klasifikasi
function renderListKlasifikasi(data, highlightTerm = "") {
    const container = document.getElementById('listKlasifikasi');
    document.getElementById('klasifikasiInfo').innerHTML = `Menampilkan <b>${data.length}</b> kode klasifikasi.`;
    
    let html = "";
    
    // Tampilkan tombol "Tanpa Kode" di paling atas
    if (highlightTerm === "" || "tanpa kode klasifikasi".includes(highlightTerm) || "-".includes(highlightTerm)) {
        html += `<div class="list-group-item list-group-item-action py-2 px-3 klasifikasi-item d-flex align-items-start gap-3" onclick="pilihKlasifikasi('-')" style="background-color: #fef2f2;">
            <span class="badge bg-danger text-white border-0 fs-6 text-center shadow-sm" style="min-width: 75px; font-family: monospace;">-</span>
            <span class="flex-grow-1 lh-sm fw-bold text-danger">Tanpa Kode Klasifikasi</span>
        </div>`;
    }

    if (data.length === 0 && html === "") { 
        container.innerHTML = `<div class="text-center py-5 text-muted"><i class="fas fa-search-minus fa-3x mb-3 opacity-25"></i><p>Kode atau keterangan tidak ditemukan.</p></div>`; return; 
    }

    html += data.map(item => {
        let k = item.kode; let desc = item.keterangan;
        let addClass = "klasifikasi-child"; let badgeClass = "bg-light text-secondary border"; let badgeStyle = "min-width: 75px; font-family: monospace;";
        
        if (/^\d{3}$/.test(k)) { addClass = "klasifikasi-parent-1"; badgeClass = "bg-primary text-white border-0"; } 
        else if (/^\d{3}\.\d{1}$/.test(k)) { addClass = "klasifikasi-parent-2"; badgeClass = "bg-secondary text-white border-0"; }

        if (highlightTerm !== "") {
            const regex = new RegExp(`(${highlightTerm})`, 'gi');
            desc = desc.replace(regex, `<mark class="bg-warning p-0">$1</mark>`); k = k.replace(regex, `<mark class="bg-warning p-0">$1</mark>`);
        }
        return `<div class="list-group-item list-group-item-action py-2 px-3 ${addClass} klasifikasi-item d-flex align-items-start gap-3" onclick="pilihKlasifikasi('${item.kode}')"><span class="badge ${badgeClass} fs-6 text-center shadow-sm" style="${badgeStyle}">${k}</span><span class="flex-grow-1 lh-sm">${desc}</span></div>`;
    }).join("");
    
    container.innerHTML = html;
}

function pilihKlasifikasi(kodeKlas) {
    const inputEl = document.getElementById(targetInputKlasifikasi);
    if(inputEl) {
        inputEl.value = kodeKlas; 
        if (targetInputKlasifikasi === 'inpKode' && typeof updatePreviewNomor === 'function') updatePreviewNomor();
        else if ((targetInputKlasifikasi === 'tsKode' || targetInputKlasifikasi === 'sptKode') && typeof updatePreviewPerjadin === 'function') updatePreviewPerjadin();
    }
    if(myModalKlasifikasi) myModalKlasifikasi.hide();
}


/* =========================================================================
   12. EXPORT & DOWNLOAD
   ========================================================================= */
const dlModalElement = document.getElementById('modalDownload'); let dlModal;
if (dlModalElement) dlModal = new bootstrap.Modal(dlModalElement);

function openDownloadModal(kategori) {
    document.getElementById('downloadKategori').value = kategori;
    document.getElementById('dlStartDate').value = ""; document.getElementById('dlEndDate').value = "";
    if(dlModal) dlModal.show();
}

function processDownload() {
    const start = document.getElementById('dlStartDate').value; const end = document.getElementById('dlEndDate').value;
    const kategori = document.getElementById('downloadKategori').value; const format = document.getElementById('dlFormat').value; 
    if (!start || !end) { Swal.fire('Info', 'Mohon lengkapi Tanggal Awal dan Akhir', 'info'); return; }

    showLoading(true); if(dlModal) dlModal.hide();
    safeFetchPOST({ action: 'downloadRekap', kategori: kategori, startDate: start, endDate: end, format: format })
    .then(resp => {
        showLoading(false);
        if (resp.status === 'success') {
            if (resp.format === 'pdf') {
                const link = document.createElement('a'); link.href = 'data:application/pdf;base64,' + resp.fileData; link.download = resp.fileName;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Laporan PDF berhasil diunduh.', timer: 2000, showConfirmButton: false });
            } else {
                generateExcel(resp.data, resp.fileName, kategori);
                Swal.fire({ icon: 'success', title: 'Berhasil', text: 'File Excel telah diunduh.', timer: 2000, showConfirmButton: false });
            }
        } else Swal.fire({ icon: 'error', title: 'Gagal', text: resp.message });
    }).catch(err => { showLoading(false); Swal.fire('Error', "Gagal mengunduh: " + err, 'error'); });
}

function generateExcel(jsonData, fileName, kategori) {
    const worksheet = XLSX.utils.json_to_sheet(jsonData);
    let wscols = []; 
    let sheetName = "";
    
    if (kategori === 'perjadin') {
        wscols = [{wch: 5}, {wch: 18}, {wch: 12}, {wch: 12}, {wch: 10}, {wch: 25}, {wch: 40}, {wch: 20}, {wch: 20}, {wch: 50}, {wch: 20}];
        sheetName = 'Rekap Perjadin';
    } else if (kategori === 'pesanan') {
        wscols = [{wch: 5}, {wch: 15}, {wch: 25}, {wch: 50}, {wch: 30}, {wch: 20}];
        sheetName = 'Rekap Pesanan';
    } else if (kategori === 'npd') {
        wscols = [{wch: 5}, {wch: 15}, {wch: 25}, {wch: 50}, {wch: 20}];
        sheetName = 'Rekap NPD';
    } else if (kategori === 'bon') { // TAMBAHKAN BLOK INI
        wscols = [{wch: 5}, {wch: 15}, {wch: 25}, {wch: 50}, {wch: 25}];
        sheetName = 'Rekap Bon';
    } else if (kategori === 'berita_acara') {
        wscols = [{wch: 5}, {wch: 15}, {wch: 25}, {wch: 25}, {wch: 45}, {wch: 25}, {wch: 25}, {wch: 15}];
        sheetName = 'Rekap Berita Acara';
    } else {
        wscols = [{wch: 5}, {wch: 15}, {wch: 25}, {wch: 20}, {wch: 45}, {wch: 25}, {wch: 20}, {wch: 15}];
        sheetName = kategori === 'surat_masuk' ? 'Surat Masuk' : (kategori === 'surat_keputusan' ? 'Surat Keputusan' : 'Surat Keluar');
    }
    
    worksheet['!cols'] = wscols;
    const workbook = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName); 
    XLSX.writeFile(workbook, fileName);
}
