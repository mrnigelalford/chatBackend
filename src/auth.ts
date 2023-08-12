export const isAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth === process.env.BOT_AUTH) {
    next();
  } else {
    res.status(401);
    res.send('Access forbidden');
  }
}