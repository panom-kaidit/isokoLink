// This runs after the auth check. It blocks the request if the user's role
// is not in the list of roles allowed to use that route.
module.exports = function allowRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Not authorized for this action" });
    }
    next();
  };
};