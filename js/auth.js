/* ============================================
   AUTH MODULE — Local Login & User Management
   ============================================ */
const Auth = (() => {
    let currentUser = null;

    // --- Initialize default admin user if none exists ---
    async function init() {
        const users = await DB.getAll('users');
        if (users.length === 0) {
            await DB.add('users', {
                username: 'Sidiq23',
                password: 'sck777',
                role: 'admin',
                permissions: { induksi: true, reweight: true, penjualan: true, settings: true }
            });
        }
        // Restore session
        const savedUser = sessionStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            return currentUser;
        }
        return null;
    }

    // --- Login ---
    async function login(username, password) {
        const user = await DB.get('users', username);
        if (!user) return { success: false, message: 'User tidak ditemukan' };
        if (user.password !== password) return { success: false, message: 'Password salah' };
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        DB.addLog('Auth', `User "${username}" logged in`);
        return { success: true, user };
    }

    // --- Logout ---
    function logout() {
        if (currentUser) {
            DB.addLog('Auth', `User "${currentUser.username}" logged out`);
        }
        currentUser = null;
        sessionStorage.removeItem('currentUser');
    }

    // --- Get current user ---
    function getUser() { return currentUser; }
    function isAdmin() { return currentUser && currentUser.role === 'admin'; }

    // --- User CRUD ---
    async function addUser(username, password, role, permissions) {
        const existing = await DB.get('users', username);
        if (existing) return { success: false, message: 'Username sudah ada' };
        await DB.add('users', { username, password, role, permissions });
        DB.addLog('Auth', `User "${username}" created with role ${role}`);
        return { success: true };
    }

    async function deleteUser(username) {
        if (username === 'Sidiq23') return { success: false, message: 'Tidak bisa menghapus admin utama' };
        await DB.remove('users', username);
        DB.addLog('Auth', `User "${username}" deleted`);
        return { success: true };
    }

    async function updateUser(username, data) {
        const user = await DB.get('users', username);
        if (!user) return { success: false, message: 'User tidak ditemukan' };
        Object.assign(user, data);
        await DB.update('users', user);
        DB.addLog('Auth', `User "${username}" updated`);
        return { success: true };
    }

    async function getAllUsers() {
        return DB.getAll('users');
    }

    // --- Check permission ---
    function hasPermission(module) {
        if (!currentUser) return false;
        if (currentUser.role === 'admin') return true;
        return currentUser.permissions && currentUser.permissions[module];
    }

    return {
        init, login, logout, getUser, isAdmin,
        addUser, deleteUser, updateUser, getAllUsers,
        hasPermission
    };
})();
