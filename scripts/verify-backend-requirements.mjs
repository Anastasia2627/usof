import mysql from 'mysql2/promise';

const base = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, {
  method = 'GET',
  token,
  body,
  expected = 200,
} = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status !== expected) {
    throw new Error(
      `${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`,
    );
  }
  return data;
}

async function login(login, email, password = 'Password123!') {
  return request('/auth/login', {
    method: 'POST',
    body: { login, email, password },
  });
}

async function verifyDatabaseRequirements() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'usof',
  });

  try {
    const tables = ['users', 'categories', 'posts', 'post_categories', 'comments', 'reactions'];
    for (const table of tables) {
      const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      assert(Number(row.count) >= 5, `${table} must contain at least five seeded rows`);
    }

    const requiredColumns = {
      users: ['login', 'password_hash', 'full_name', 'email', 'avatar', 'rating', 'role'],
      posts: ['author_id', 'title', 'created_at', 'status', 'content'],
      categories: ['title', 'description'],
      comments: ['author_id', 'created_at', 'content'],
      reactions: ['author_id', 'created_at', 'post_id', 'comment_id', 'type'],
    };

    for (const [table, expectedColumns] of Object.entries(requiredColumns)) {
      const [rows] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      const actual = new Set(rows.map((row) => row.Field));
      for (const column of expectedColumns) {
        assert(actual.has(column), `${table}.${column} is required by the backend specification`);
      }
    }

    const [[passwordRow]] = await connection.query(
      "SELECT password_hash FROM users WHERE login='asya' LIMIT 1",
    );
    assert(passwordRow?.password_hash?.startsWith('$2'), 'Seed passwords must be stored as bcrypt hashes');

    const [userIndexes] = await connection.query('SHOW INDEX FROM users');
    const uniqueLogin = userIndexes.some(
      (index) => index.Column_name === 'login' && Number(index.Non_unique) === 0,
    );
    assert(uniqueLogin, 'users.login must be unique');

    const [reactionChecks] = await connection.query(
      `SELECT COUNT(*) AS invalid_targets
       FROM reactions
       WHERE (post_id IS NULL AND comment_id IS NULL)
          OR (post_id IS NOT NULL AND comment_id IS NOT NULL)`,
    );
    assert(Number(reactionChecks[0].invalid_targets) === 0, 'Every reaction must target exactly one post/comment');
  } finally {
    await connection.end();
  }
}

await verifyDatabaseRequirements();

const admin = await login('admin', 'admin@usof.local');
const asya = await login('asya', 'asya@usof.local');
const alex = await login('alex', 'alex@usof.local');
const maria = await login('maria', 'maria@usof.local');
const sam = await login('sam', 'sam@usof.local');

// Admin-created users must explicitly declare whether the new account is user/admin.
const stamp = String(Date.now());
const managedLogin = `managed_${stamp.slice(-7)}`;
const managedEmail = `${managedLogin}@example.com`;
await request('/users', {
  method: 'POST',
  token: admin.token,
  expected: 422,
  body: {
    login: `${managedLogin}_missing_role`,
    email: `missing_${managedEmail}`,
    password: 'Password123!',
    passwordConfirmation: 'Password123!',
  },
});
const managed = await request('/users', {
  method: 'POST',
  token: admin.token,
  expected: 201,
  body: {
    login: managedLogin,
    email: managedEmail,
    fullName: 'Managed Requirement User',
    role: 'user',
    password: 'Password123!',
    passwordConfirmation: 'Password123!',
  },
});
assert(managed.data.role === 'user', 'Admin user creation must preserve the requested role');
await request(`/users/${managed.data.id}`, {
  method: 'PATCH',
  token: admin.token,
  body: { role: 'admin', fullName: 'Managed Requirement Admin' },
});
const managedAfterUpdate = await request(`/users/${managed.data.id}`, { token: admin.token });
assert(managedAfterUpdate.data.role === 'admin', 'Only admin role changes must work');
await request(`/users/${managed.data.id}`, { method: 'DELETE', token: admin.token, expected: 204 });

const categories = await request('/categories');
assert(categories.data.length >= 5, 'At least five categories must be available');
const categoryA = Number(categories.data[0].id);
const categoryB = Number(categories.data[1].id);

// Create two posts whose net score ties, but whose number of likes differs.
// This proves that sort=likes follows the PDF literally rather than sorting by net score.
const postA = await request('/posts', {
  method: 'POST',
  token: asya.token,
  expected: 201,
  body: {
    title: `PDF likes-sort A ${stamp}`,
    content: 'One like and one dislike: net score zero, but one positive like.',
    categories: [categoryA, categoryB],
  },
});
const postB = await request('/posts', {
  method: 'POST',
  token: asya.token,
  expected: 201,
  body: {
    title: `PDF likes-sort B ${stamp}`,
    content: 'No likes: net score is also zero.',
    categories: [categoryA],
  },
});

await request(`/posts/${postA.data.id}/like`, {
  method: 'POST',
  token: alex.token,
  body: { type: 'like' },
});
await request(`/posts/${postA.data.id}/like`, {
  method: 'POST',
  token: maria.token,
  body: { type: 'dislike' },
});

const sorted = await request(`/posts?author=${asya.user.id}&sort=likes&order=desc&limit=50`, {
  token: asya.token,
});
const indexA = sorted.data.findIndex((post) => Number(post.id) === Number(postA.data.id));
const indexB = sorted.data.findIndex((post) => Number(post.id) === Number(postB.data.id));
assert(indexA >= 0 && indexB >= 0 && indexA < indexB, 'Posts must sort by positive like count by default/likes');

const filteredByCategory = await request(`/posts?category=${categoryB}&author=${asya.user.id}&limit=50`, {
  token: asya.token,
});
assert(
  filteredByCategory.data.some((post) => Number(post.id) === Number(postA.data.id)),
  'Category filtering must include matching posts',
);
assert(
  !filteredByCategory.data.some((post) => Number(post.id) === Number(postB.data.id)),
  'Category filtering must exclude non-matching posts',
);

const broadDateFilter = await request('/posts?from=2000-01-01&to=2100-01-01&limit=1');
assert(broadDateFilter.pagination.limit === 1, 'Date filtering and pagination must work together');

// Admin may change status/categories, but must not edit post content/title.
await request(`/posts/${postB.data.id}`, {
  method: 'PATCH',
  token: admin.token,
  expected: 403,
  body: { content: 'Admin must not be able to replace user content.' },
});
await request(`/posts/${postB.data.id}`, {
  method: 'PATCH',
  token: admin.token,
  body: { status: 'inactive', categories: [categoryB] },
});

await request(`/posts/${postB.data.id}`, { expected: 404 });
const ownerInactive = await request(`/posts/${postB.data.id}`, { token: asya.token });
assert(ownerInactive.data.status === 'inactive', 'Owner must see their own inactive post');
await request(`/posts/${postB.data.id}`, { token: alex.token, expected: 404 });
const adminInactive = await request(`/posts/${postB.data.id}`, { token: admin.token });
assert(adminInactive.data.status === 'inactive', 'Admin must see inactive posts');

const ownerInactiveList = await request(`/posts?status=inactive&author=${asya.user.id}&limit=50`, {
  token: asya.token,
});
assert(
  ownerInactiveList.data.some((post) => Number(post.id) === Number(postB.data.id)),
  'User status filter must include their personal inactive post',
);
const otherInactiveList = await request(`/posts?status=inactive&author=${asya.user.id}&limit=50`, {
  token: alex.token,
});
assert(
  !otherInactiveList.data.some((post) => Number(post.id) === Number(postB.data.id)),
  'Other users must not see inactive posts',
);

// Likes are viewable by regular users only for active post/comment targets; admin can inspect inactive ones.
await request(`/posts/${postB.data.id}/like`, { token: asya.token, expected: 404 });
await request(`/posts/${postB.data.id}/like`, { token: admin.token });

// Regular users may change the status of any comment, exactly as stated in the PDF,
// while comment content remains immutable and deletion remains owner/admin controlled.
const commentTarget = await request('/comments/1');
const originalCommentContent = commentTarget.data.content;
assert(Number(commentTarget.data.author_id) !== Number(asya.user.id), 'Seed comment 1 should belong to another user');

const hiddenByAnotherUser = await request('/comments/1', {
  method: 'PATCH',
  token: asya.token,
  body: { status: 'inactive' },
});
assert(hiddenByAnotherUser.data.status === 'inactive', 'Any authenticated user must be able to change comment status');

const allPostComments = await request(`/posts/${hiddenByAnotherUser.data.post_id}/comments`);
const hiddenFromList = allPostComments.data.find((comment) => Number(comment.id) === 1);
assert(hiddenFromList?.status === 'inactive', 'All comments for a viewable post must be returned, including inactive status');

await request('/comments/1/like', { expected: 404 });
await request('/comments/1/like', { token: admin.token });

await request('/comments/1', {
  method: 'PATCH',
  token: sam.token,
  expected: 403,
  body: { content: 'This must never replace the original comment content.' },
});
await request('/comments/1', {
  method: 'PATCH',
  token: admin.token,
  expected: 403,
  body: { content: 'Admins also cannot edit comment content.' },
});
const unchangedComment = await request('/comments/1');
assert(unchangedComment.data.content === originalCommentContent, 'Comment content must remain immutable');

await request('/comments/1', { method: 'DELETE', token: asya.token, expected: 403 });
await request('/comments/1', {
  method: 'PATCH',
  token: sam.token,
  body: { status: 'active' },
});

// Locking must prevent ordinary interaction while keeping admin moderation possible.
await request(`/posts/${postA.data.id}`, {
  method: 'PATCH',
  token: admin.token,
  body: { locked: true },
});
await request(`/posts/${postA.data.id}/comments`, {
  method: 'POST',
  token: alex.token,
  expected: 423,
  body: { content: 'This comment must be blocked because the post is locked.' },
});
await request(`/posts/${postA.data.id}/like`, {
  method: 'POST',
  token: sam.token,
  expected: 423,
  body: { type: 'like' },
});
await request(`/posts/${postA.data.id}`, {
  method: 'PATCH',
  token: admin.token,
  body: { locked: false },
});

// Non-owners must not edit another user's post.
await request(`/posts/${postA.data.id}`, {
  method: 'PATCH',
  token: sam.token,
  expected: 403,
  body: { content: 'Forbidden edit' },
});

// Clean up temporary posts. Cascades also exercise dependent reaction deletion/rating recalculation.
await request(`/posts/${postA.data.id}`, { method: 'DELETE', token: asya.token, expected: 204 });
await request(`/posts/${postB.data.id}`, { method: 'DELETE', token: asya.token, expected: 204 });

console.log('Backend PDF requirement verification passed.');
