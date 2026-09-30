const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const { profileUpdateSchema } = require('../src/schemas/auth.schema');
const { updateMe } = require('../src/controllers/auth.controller');

describe('Profile updates', () => {
  test('validates supported profile fields and rejects an empty update', () => {
    expect(profileUpdateSchema.body.safeParse({}).success).toBe(false);
    expect(profileUpdateSchema.body.safeParse({ email: 'invalid' }).success).toBe(false);
    expect(profileUpdateSchema.body.safeParse({ name: 'Ada', email: 'ADA@example.com' }).data)
      .toEqual({ name: 'Ada', email: 'ada@example.com' });
    expect(profileUpdateSchema.body.safeParse({ avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }).success)
      .toBe(false);
  });

  test('updates name, email, avatar, and hashes password changes', async () => {
    const user = {
      _id: 'user-1',
      name: 'Before',
      email: 'before@example.com',
      passwordHash: 'old-hash',
      tokenVersion: 0,
      avatar: null,
      save: jest.fn().mockResolvedValue(undefined)
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();
    const avatar = 'data:image/png;base64,aGVsbG8=';
    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    await updateMe({
      user,
      body: { name: 'Ada', email: 'ada@example.com', password: 'new-password', avatar }
    }, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(user.name).toBe('Ada');
    expect(user.email).toBe('ada@example.com');
    expect(user.avatar).toBe(avatar);
    expect(await bcrypt.compare('new-password', user.passwordHash)).toBe(true);
    expect(user.passwordHash).not.toBe('new-password');
    expect(user.tokenVersion).toBe(1);
    expect(user.save).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ success: true, data: { user } });
  });

  test('does not allow an email already used by another user', async () => {
    const user = {
      _id: 'user-1',
      email: 'before@example.com',
      save: jest.fn()
    };
    const next = jest.fn();
    jest.spyOn(User, 'findOne').mockResolvedValue({ _id: 'user-2' });

    await updateMe({ user, body: { email: 'taken@example.com' } }, {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(user.email).toBe('before@example.com');
    expect(user.save).not.toHaveBeenCalled();
  });

  afterEach(() => jest.restoreAllMocks());
});
