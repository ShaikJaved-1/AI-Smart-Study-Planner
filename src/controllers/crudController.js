const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { ok, created } = require('../utils/response');
const stringParams = require('../utils/query');

// Builds list/create/update/remove handlers for a user-owned resource.
//   label:    'Assignment' (used in messages)
//   repo:     repository with list, findById, create, update, remove
//   validate: async (body, existing, userId) => { errors, value }
//   afterChange: optional async (userId, action) run after update/remove (e.g. automatic rescheduling)
function createCrudController({ label, repo, validate, afterChange }) {
  const notFoundError = () => new HttpError(404, `${label} not found`);
  const parseId = (req) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `Invalid ${label.toLowerCase()} id`);
    return id;
  };

  return {
    list: asyncHandler(async (req, res) => {
      ok(res, `${label}s retrieved successfully`, await repo.list(req.user.id, stringParams(req.query)));
    }),

    create: asyncHandler(async (req, res) => {
      const { errors, value } = await validate(req.body || {}, null, req.user.id);
      if (errors.length) throw new HttpError(400, errors.join('. '));
      const id = await repo.create(req.user.id, value);
      created(res, `${label} created successfully`, await repo.findById(id, req.user.id));
    }),

    update: asyncHandler(async (req, res) => {
      const id = parseId(req);
      const existing = await repo.findById(id, req.user.id);
      if (!existing) throw notFoundError();
      const { errors, value } = await validate({ ...existing, ...(req.body || {}) }, existing, req.user.id);
      if (errors.length) throw new HttpError(400, errors.join('. '));
      await repo.update(id, req.user.id, value);
      if (afterChange) await afterChange(req.user.id, 'update');
      ok(res, `${label} updated successfully`, await repo.findById(id, req.user.id));
    }),

    remove: asyncHandler(async (req, res) => {
      const id = parseId(req);
      if (!(await repo.remove(id, req.user.id))) throw notFoundError();
      if (afterChange) await afterChange(req.user.id, 'remove');
      ok(res, `${label} deleted successfully`);
    })
  };
}
module.exports = createCrudController;
