const now = Date.now();
const iso = (minutesAgo = 0) => new Date(now - minutesAgo * 60_000).toISOString();

const users = [
  { id: 1, login: 'maya', full_name: 'Maya Chen', email: 'maya@circle.local', email_verified: 1, avatar: '', rating: 84, role: 'user' },
  { id: 2, login: 'noah', full_name: 'Noah Reed', email: 'noah@circle.local', email_verified: 1, avatar: '', rating: 41, role: 'user' },
  { id: 3, login: 'lina', full_name: 'Lina Park', email: 'lina@circle.local', email_verified: 1, avatar: '', rating: 118, role: 'user' },
  { id: 4, login: 'admin', full_name: 'Circle Admin', email: 'admin@circle.local', email_verified: 1, avatar: '', rating: 190, role: 'admin' },
];

const categories = [
  { id: 1, title: 'Life', description: 'The small things, big changes, and everything in between.' },
  { id: 2, title: 'Design', description: 'Visual culture, products, taste, and making things feel right.' },
  { id: 3, title: 'Music', description: 'Songs on repeat, new finds, concerts, and old favorites.' },
  { id: 4, title: 'Work', description: 'Careers, freelancing, office stories, and figuring it out.' },
  { id: 5, title: 'Travel', description: 'Places, routes, tiny discoveries, and stories from elsewhere.' },
  { id: 6, title: 'Random', description: 'Thoughts that do not need a category, but deserve a thread.' },
];

const starterPosts = [
  {
    id: 1, author_id: 1, author_login: 'maya', author_rating: 84, author_avatar: '',
    title: 'What tiny thing made your day unexpectedly better?',
    content: 'Mine was a stranger holding the tram door while I was running in the rain. Very small thing, but I kept thinking about it all afternoon.',
    status: 'active', locked: 0, created_at: iso(24), updated_at: iso(24),
    score: 24, like_count: 22, comment_count: 18, favorite_count: 7, follower_count: 8, share_count: 2,
    categories: [categories[0], categories[5]],
  },
  {
    id: 2, author_id: 2, author_login: 'noah', author_rating: 41, author_avatar: '',
    title: 'Do you actually listen to albums from start to finish anymore?',
    content: 'I realized playlists changed the way I listen to music. Curious whether full albums still feel like a thing for people here.',
    status: 'active', locked: 0, created_at: iso(71), updated_at: iso(71),
    score: 17, like_count: 15, comment_count: 26, favorite_count: 4, follower_count: 12, share_count: 1,
    categories: [categories[2]],
  },
  {
    id: 3, author_id: 3, author_login: 'lina', author_rating: 118, author_avatar: '',
    title: 'The best interfaces are getting quieter again',
    content: 'Less glass, fewer glowing blobs, more typography and restraint. I am seeing it everywhere lately and I am very into it.',
    status: 'active', locked: 0, created_at: iso(132), updated_at: iso(132),
    score: 39, like_count: 36, comment_count: 14, favorite_count: 19, follower_count: 15, share_count: 8,
    categories: [categories[1]],
  },
  {
    id: 4, author_id: 1, author_login: 'maya', author_rating: 84, author_avatar: '',
    title: 'If you could disappear somewhere for three days, where would you go?',
    content: 'No work, no notifications, no obligations. I would pick a tiny place near a lake and bring one book.',
    status: 'active', locked: 0, created_at: iso(220), updated_at: iso(220),
    score: 13, like_count: 12, comment_count: 21, favorite_count: 10, follower_count: 6, share_count: 3,
    categories: [categories[4], categories[0]],
  },
  {
    id: 5, author_id: 2, author_login: 'noah', author_rating: 41, author_avatar: '',
    title: 'What is a job skill nobody warns you is actually essential?',
    content: 'Not the thing in the job description. The weird soft skill you only discover after you start doing the work.',
    status: 'active', locked: 0, created_at: iso(330), updated_at: iso(330),
    score: 31, like_count: 28, comment_count: 33, favorite_count: 16, follower_count: 17, share_count: 4,
    categories: [categories[3]],
  },
  {
    id: 6, author_id: 3, author_login: 'lina', author_rating: 118, author_avatar: '',
    title: 'Name a completely ordinary place you are weirdly attached to',
    content: 'There is a bench near my old school that is objectively nothing special, but it still feels like a checkpoint in my life.',
    status: 'active', locked: 0, created_at: iso(490), updated_at: iso(490),
    score: 20, like_count: 19, comment_count: 11, favorite_count: 5, follower_count: 4, share_count: 2,
    categories: [categories[0], categories[5]],
  },
];

const comments = [
  { id: 1, post_id: 1, author_id: 2, author_login: 'noah', author_rating: 41, author_avatar: '', parent_comment_id: null, content: 'A barista remembered my order after I had only been there twice.', status: 'active', locked: 0, post_locked: 0, created_at: iso(18), score: 7, like_count: 7 },
  { id: 2, post_id: 1, author_id: 3, author_login: 'lina', author_rating: 118, author_avatar: '', parent_comment_id: 1, content: 'That kind of recognition genuinely changes the whole mood of a place.', status: 'active', locked: 0, post_locked: 0, created_at: iso(14), score: 4, like_count: 4 },
];

const notifications = [
  { id: 1, type: 'comment', post_id: 1, title: 'New reply in a thread you follow', body: 'Noah joined the conversation.', read_at: null, created_at: iso(9) },
  { id: 2, type: 'reaction', post_id: 3, title: 'Someone found your thread useful', body: 'Your post received a new reaction.', read_at: null, created_at: iso(43) },
  { id: 3, type: 'post_updated', post_id: 5, title: 'A conversation is moving fast', body: 'A thread you follow has new activity.', read_at: iso(40), created_at: iso(180) },
];

function demoAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem('circle-demo-accounts') || '[]');
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    return [];
  }
}
function allUsers() {
  return [...users, ...demoAccounts()];
}
function saveDemoAccounts(accounts) {
  localStorage.setItem('circle-demo-accounts', JSON.stringify(accounts));
}
function savedPosts() {
  try {
    return JSON.parse(localStorage.getItem('circle-mock-posts') || '[]');
  } catch {
    return [];
  }
}

function allPosts() {
  return [...savedPosts(), ...starterPosts];
}

function pagination(data, page = 1, limit = 8) {
  const start = (page - 1) * limit;
  return {
    data: data.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total: data.length,
      totalPages: Math.max(1, Math.ceil(data.length / limit)),
    },
  };
}

function userFromToken(token) {
  const match = String(token || '').match(/^mock-token-(\d+)$/);
  if (!match) return users[0];
  return allUsers().find((user) => Number(user.id) === Number(match[1])) || users[0];
}

function filterPosts(url) {
  let data = allPosts();
  const search = (url.searchParams.get('search') || '').toLowerCase();
  const category = Number(url.searchParams.get('category') || 0);
  const sort = url.searchParams.get('sort') || 'date';
  const status = url.searchParams.get('status');
  const author = Number(url.searchParams.get('author') || 0);

  if (search) {
    data = data.filter((post) => [post.title, post.content, post.author_login]
      .some((value) => String(value).toLowerCase().includes(search)));
  }
  if (category) data = data.filter((post) => post.categories.some((item) => Number(item.id) === category));
  if (status) data = data.filter((post) => post.status === status);
  if (author) data = data.filter((post) => Number(post.author_id) === author);

  if (sort === 'likes') data.sort((a, b) => Number(b.like_count) - Number(a.like_count));
  else if (sort === 'trending') data.sort((a, b) => (Number(b.comment_count) + Number(b.like_count)) - (Number(a.comment_count) + Number(a.like_count)));
  else data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return data;
}

export async function mockApi(path, { method = 'GET', body, token } = {}) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const url = new URL(path, 'http://circle.local');
  const pathname = url.pathname;

  if (pathname === '/categories' && method === 'GET') return { data: categories };

  const categoryMatch = pathname.match(/^\/categories\/(\d+)$/);
  if (categoryMatch && method === 'GET') {
    return { data: categories.find((item) => item.id === Number(categoryMatch[1])) || categories[0] };
  }

  const categoryPostsMatch = pathname.match(/^\/categories\/(\d+)\/posts$/);
  if (categoryPostsMatch && method === 'GET') {
    const id = Number(categoryPostsMatch[1]);
    return { data: allPosts().filter((post) => post.categories.some((item) => Number(item.id) === id)) };
  }

  if (pathname === '/posts' && method === 'GET') {
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 8);
    return pagination(filterPosts(url), page, limit);
  }

  if (pathname === '/posts' && method === 'POST') {
    const current = userFromToken(token);
    const posts = savedPosts();
    const post = {
      id: Math.max(100, ...allPosts().map((item) => Number(item.id))) + 1,
      author_id: current.id,
      author_login: current.login,
      author_rating: current.rating,
      author_avatar: current.avatar,
      title: body?.title || 'Untitled thread',
      content: body?.content || '',
      status: 'active',
      locked: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      score: 0,
      like_count: 0,
      comment_count: 0,
      favorite_count: 0,
      follower_count: 0,
      share_count: 0,
      categories: categories.filter((item) => (body?.categories || []).map(Number).includes(item.id)),
    };
    localStorage.setItem('circle-mock-posts', JSON.stringify([post, ...posts]));
    return { data: post };
  }

  const postMatch = pathname.match(/^\/posts\/(\d+)$/);
  if (postMatch && method === 'GET') {
    const post = allPosts().find((item) => Number(item.id) === Number(postMatch[1]));
    if (!post) throw new Error('Thread not found');
    return { data: post };
  }

  if (postMatch && method === 'PATCH') {
    const id = Number(postMatch[1]);
    const posts = savedPosts();
    const index = posts.findIndex((item) => Number(item.id) === id);
    if (index >= 0) {
      posts[index] = { ...posts[index], ...body, updated_at: new Date().toISOString() };
      localStorage.setItem('circle-mock-posts', JSON.stringify(posts));
      return { data: posts[index] };
    }
    return { data: allPosts().find((item) => Number(item.id) === id) };
  }

  const postCommentsMatch = pathname.match(/^\/posts\/(\d+)\/comments$/);
  if (postCommentsMatch && method === 'GET') {
    return { data: comments.filter((item) => Number(item.post_id) === Number(postCommentsMatch[1])) };
  }
  if (postCommentsMatch && method === 'POST') return { data: { id: Date.now(), ...body } };

  if (/^\/posts\/\d+\/like$/.test(pathname)) {
    if (method === 'GET') return { data: [] };
    return { message: 'Mock reaction saved' };
  }

  if (/^\/comments\/\d+\/like$/.test(pathname)) {
    if (method === 'GET') return { data: [] };
    return { message: 'Mock reaction saved' };
  }

  if (/^\/comments\/\d+$/.test(pathname)) return { data: body || {}, message: 'Mock comment updated' };

  if (/^\/posts\/\d+\/engagement$/.test(pathname)) return { data: { favorite: false, following: false } };
  if (/^\/posts\/\d+\/(favorite|follow|share)$/.test(pathname)) return { message: 'Mock action saved' };

  if (pathname === '/auth/register' && method === 'POST') {
    const login = String(body?.login || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const fullName = String(body?.fullName || '').trim();
    if (login.length < 3 || login.length > 50) throw new Error('Username must be 3–50 characters.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid-looking demo email.');
    if (String(body?.password || '').length < 8) throw new Error('Use at least 8 characters for the demo password.');
    if (body?.password !== body?.passwordConfirmation) throw new Error('Passwords do not match.');
    if (allUsers().some((user) => user.login.toLowerCase() === login.toLowerCase() || user.email.toLowerCase() === email)) {
      throw new Error('This demo username or email is already in use.');
    }
    const accounts = demoAccounts();
    const user = {
      id: Math.max(999, ...allUsers().map((item) => Number(item.id))) + 1,
      login, full_name: fullName, email, email_verified: 1,
      avatar: '', rating: 0, role: 'user',
    };
    saveDemoAccounts([...accounts, user]); // Do not save the demo password.
    return {
      token: 'mock-token-' + user.id, user, emailDelivery: 'preview-only',
      verificationToken: 'circle-preview-link-token', verificationCode: '482731',
    };
  }
  if (pathname === '/auth/login' && method === 'POST') {
    const identifier = String(body?.login || body?.email || '').trim().toLowerCase();
    const user = allUsers().find((account) =>
      account.login.toLowerCase() === identifier || account.email.toLowerCase() === identifier);
    if (!user || !body?.password) throw new Error('Demo account not found. Sign up or use a sample account.');
    // Demo accepts any non-empty password, never use real credentials.
    return { token: 'mock-token-' + user.id, user };
  }

  if (pathname === '/users' && method === 'GET') return { data: allUsers() };
  const userMatch = pathname.match(/^\/users\/(\d+)$/);
  if (userMatch && method === 'GET') {
    const user = allUsers().find((entry) => Number(entry.id) === Number(userMatch[1]));
    if (!user) throw new Error('Demo profile not found.');
    return { data: user };
  }
  if (userMatch && method === 'PATCH') {
    const id = Number(userMatch[1]);
    const existing = allUsers().find((entry) => Number(entry.id) === id);
    if (!existing) throw new Error('Demo profile not found.');
    const updated = { ...existing, full_name: String(body?.fullName ?? existing.full_name).trim().slice(0, 100) };
    const accounts = demoAccounts();
    if (accounts.some((entry) => Number(entry.id) === id)) {
      saveDemoAccounts(accounts.map((entry) => Number(entry.id) === id ? updated : entry));
    }
    return { data: updated };
  }
  if (userMatch && method === 'DELETE') {
    const id = Number(userMatch[1]);
    saveDemoAccounts(demoAccounts().filter((entry) => Number(entry.id) !== id));
    localStorage.setItem('circle-mock-posts', JSON.stringify(savedPosts().filter((post) => Number(post.author_id) !== id)));
    return { message: 'Demo profile deleted.' };
  }
  if (pathname === '/users/avatar' && method === 'PATCH') {
    throw new Error('Avatar upload is unavailable in demo mode; use the real API to test file uploads.');
  }

  if (pathname === '/auth/google' && method === 'POST') {
    return { token: 'mock-token-1', user: users[0] };
  }

  if (pathname === '/auth/logout' && method === 'POST') return null;
  if (pathname === '/auth/verify-email-code' && method === 'POST') return { message: 'Email verified' };
  if (/^\/auth\/verify-email\//.test(pathname) && method === 'POST') return { message: 'Email verified' };
  if (pathname === '/auth/password-reset' && method === 'POST') return { message: 'Mock reset link created', resetToken: 'circle-reset-preview' };
  if (/^\/auth\/password-reset\//.test(pathname) && method === 'POST') return { message: 'Password changed' };

  if (pathname.startsWith('/library/')) {
    return pagination(allPosts().slice(0, 4), Number(url.searchParams.get('page') || 1), Number(url.searchParams.get('limit') || 8));
  }

  if (pathname === '/notifications') {
    const unreadOnly = url.searchParams.get('unread') === '1';
    const data = unreadOnly ? notifications.filter((item) => !item.read_at) : notifications;
    return { data, unreadCount: notifications.filter((item) => !item.read_at).length };
  }
  if (pathname === '/notifications/read-all' || /^\/notifications\/\d+\/(read)?$/.test(pathname)) return { message: 'Updated' };
  if (/^\/notifications\/\d+$/.test(pathname)) return { message: 'Updated' };

  if (pathname === '/dashboard/admin') {
    // UI preview only: all figures below come from in-browser demonstration data.
    const posts = allPosts();
    const members = allUsers();
    const categoryPosts = (categoryId) => posts.filter((post) =>
      post.categories.some((category) => Number(category.id) === Number(categoryId)));
    const inactivePosts = posts.filter((post) => post.status === 'inactive' || post.locked);
    const inactiveComments = comments.filter((comment) => comment.status === 'inactive' || comment.locked);
    const sumField = (field) => posts.reduce((sum, post) => sum + Number(post[field] || 0), 0);
    const growth = Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      const date = day.toISOString().slice(0, 10);
      return {
        date,
        users: 0,
        posts: posts.filter((post) => post.created_at?.slice(0, 10) === date).length,
        comments: comments.filter((comment) => comment.created_at?.slice(0, 10) === date).length,
        reactions: 0,
      };
    });
    return {
      data: {
        overview: {
          users: members.length,
          verified_users: members.filter((user) => user.email_verified).length,
          new_users_7d: 0,
          posts: posts.length,
          active_posts: posts.filter((post) => post.status === 'active').length,
          inactive_posts: posts.filter((post) => post.status === 'inactive').length,
          locked_posts: posts.filter((post) => post.locked).length,
          moderation_posts: inactivePosts.length,
          comments: comments.length,
          inactive_comments: comments.filter((comment) => comment.status === 'inactive').length,
          locked_comments: comments.filter((comment) => comment.locked).length,
          moderation_comments: inactiveComments.length,
          reactions: sumField('like_count'),
          favorites: sumField('favorite_count'),
          following: sumField('follower_count'),
          shares: sumField('share_count'),
          unread_notifications: notifications.filter((item) => !item.read_at).length,
        },
        growth,
        topContributors: members.map((user) => ({
          ...user,
          posts: posts.filter((post) => Number(post.author_id) === Number(user.id)).length,
          answers: comments.filter((comment) => Number(comment.author_id) === Number(user.id)).length,
        })).sort((a, b) => b.rating - a.rating),
        topCategories: categories.map((category) => {
          const relatedPosts = categoryPosts(category.id);
          return {
            ...category,
            posts: relatedPosts.length,
            comments: comments.filter((comment) =>
              relatedPosts.some((post) => Number(post.id) === Number(comment.post_id))).length,
          };
        }).sort((a, b) => b.posts - a.posts),
        reactionMix: [{ type: 'like', count: sumField('like_count') }],
        moderation: {
          posts: inactivePosts,
          comments: inactiveComments.map((comment) => ({
            ...comment,
            post_title: posts.find((post) => Number(post.id) === Number(comment.post_id))?.title || 'Conversation',
          })),
        },
      },
    };
  }

  if (pathname === '/dashboard/me') {
    const current = userFromToken(token);
    if (Number(current.id) >= 1000) {
      const ownPosts = allPosts().filter((post) => Number(post.author_id) === Number(current.id));
      return {
        data: {
          trust: { name: 'Newcomer', rating: Number(current.rating || 0), nextLevelAt: 10, progress: 0 },
          stats: {
            communityRank: allUsers().length, contributors: allUsers().length,
            answers: 0, answersThisWeek: 0, posts: ownPosts.length,
            positiveReactionsReceived: 0, contributionStreak: 0,
            favorites: 0, following: 0, unreadNotifications: 0,
          },
          weeklyGoal: { current: 0, target: 5, completed: false },
          achievements: [
            { id: 'first-post', title: 'First conversation', description: 'Publish your first post.', progress: Math.min(1, ownPosts.length), target: 1, unlocked: ownPosts.length >= 1 },
          ],
          reactionsReceived: {},
          suggestions: allPosts().filter((post) => Number(post.author_id) !== Number(current.id)).slice(0, 4),
        },
      };
    }
    return {
      data: {
        trust: { name: 'Contributor', rating: 24, nextLevelAt: 30, progress: 80 },
        stats: {
          communityRank: 12, contributors: 84, answers: 8, answersThisWeek: 3, posts: 5,
          positiveReactionsReceived: 32, contributionStreak: 4, favorites: 7, following: 9, unreadNotifications: 2,
        },
        weeklyGoal: { current: 3, target: 5, completed: false },
        achievements: [
          { id: 1, title: 'First thread', description: 'Started a conversation.', progress: 1, target: 1, unlocked: true },
          { id: 2, title: 'Good neighbor', description: 'Replied to five people.', progress: 4, target: 5, unlocked: false },
          { id: 3, title: 'Worth saving', description: 'Received ten saves.', progress: 7, target: 10, unlocked: false },
        ],
        reactionsReceived: { like: 22, useful: 6, thanks: 3, fire: 1 },
        suggestions: allPosts().slice(1, 4),
      },
    };
  }

  return { data: [], pagination: { page: 1, limit: 8, total: 0, totalPages: 1 } };
}

export function resetMockData() {
  localStorage.removeItem('circle-mock-posts');
}
