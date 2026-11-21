import jwt from 'jsonwebtoken';

export default function verifyJWT(req, res, next) {
  // Accept tokens from Authorization: Bearer <token>
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return res.status(401).json({ message: 'Access denied' });
  }

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Failed to authenticate token' });
  }
}
