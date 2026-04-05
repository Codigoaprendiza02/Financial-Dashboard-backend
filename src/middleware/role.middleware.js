const roleGuard = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            });
        }

        // Roles hierarchy: ADMIN > ANALYST > VIEWER
        // Alternatively we can use explicit matching if passed as an array
        // In the PRD: requireRole(ANALYST) — ANALYST or ADMIN
        // and requireRole(ADMIN) — ADMIN only
        // Since allowedRoles provides flexibility, we can pass ['ADMIN', 'ANALYST']
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Insufficient permissions to access this resource'
                }
            });
        }
        
        next();
    };
};

// Aliases for clean routing as per PRD
const requireAuth = () => roleGuard('VIEWER', 'ANALYST', 'ADMIN');
const requireRole = (role) => {
    if (role === 'ADMIN') return roleGuard('ADMIN');
    if (role === 'ANALYST') return roleGuard('ANALYST', 'ADMIN');
    if (role === 'VIEWER') return roleGuard('VIEWER', 'ANALYST', 'ADMIN');
    return roleGuard(role);
};

module.exports = {
    roleGuard,
    requireAuth,
    requireRole
};
