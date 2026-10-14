const send = (res, status, message, data) =>
  res.status(status).json({ success: true, message, data: data === undefined ? {} : data });

module.exports = {
  ok: (res, message, data) => send(res, 200, message, data),
  created: (res, message, data) => send(res, 201, message, data)
};
