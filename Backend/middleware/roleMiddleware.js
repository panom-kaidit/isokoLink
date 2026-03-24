// roleMiddleware.js - allows only specific roles to proceed
module.exports = function allowRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Not authorized for this action" });
    }
    next();
  };
};