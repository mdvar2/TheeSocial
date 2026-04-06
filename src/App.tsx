import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  where, 
  doc, 
  getDocs, 
  limit, 
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { 
  Home, 
  Search, 
  Bell, 
  User, 
  LogOut, 
  Plus, 
  Heart, 
  MessageCircle, 
  Trash2, 
  Settings,
  MoreHorizontal,
  ArrowLeft,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';

import { db, auth } from './lib/firebase';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { postService, followService } from './lib/services';
import { Post, Comment, Notification, UserProfile } from './types';

import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './components/ui/card';
import { Input } from './components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ScrollArea } from './components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from './components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { Separator } from './components/ui/separator';
import { Textarea } from './components/ui/textarea';

// --- Components ---

const PostCard: React.FC<{ post: Post; currentUserId: string }> = ({ post, currentUserId }) => {
  const { profile } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const likeId = `${currentUserId}_${post.id}`;
    const unsubscribe = onSnapshot(doc(db, 'likes', likeId), (doc) => {
      setIsLiked(doc.exists());
    });
    return () => unsubscribe();
  }, [post.id, currentUserId]);

  useEffect(() => {
    if (showComments) {
      const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      });
      return () => unsubscribe();
    }
  }, [showComments, post.id]);

  const handleLike = async () => {
    try {
      await postService.toggleLike(post.id, currentUserId, post.authorId, profile?.displayName || 'Someone');
    } catch (e) {
      toast.error('Failed to like post');
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !profile) return;
    try {
      await postService.addComment(post.id, newComment, profile, post.authorId);
      setNewComment('');
    } catch (e) {
      toast.error('Failed to add comment');
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await postService.deletePost(post.id);
      toast.success('Post deleted');
    } catch (e) {
      toast.error('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="mb-4 border-none shadow-sm hover:shadow-xl transition-all duration-300 bg-white/60 backdrop-blur-md ring-1 ring-white/20 group">
      <CardHeader className="flex flex-row items-center space-x-4 p-4">
        <Avatar className="h-12 w-12 ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all">
          <AvatarImage src={post.authorPhoto} referrerPolicy="no-referrer" />
          <AvatarFallback className="bg-primary/5 text-primary font-bold">{post.authorName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm hover:text-primary transition-colors cursor-pointer">{post.authorName}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
            </span>
          </div>
        </div>
        {(currentUserId === post.authorId || profile?.role === 'admin') && (
          <Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DialogTrigger render={<DropdownMenuItem className="text-destructive" />}>
                  <div className="flex items-center">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </div>
                </DialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Post</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete this post? This action cannot be undone.
                </p>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete Post'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="px-4 py-2">
        <p className="text-base font-medium text-foreground/90 whitespace-pre-wrap leading-relaxed">{post.content}</p>
      </CardContent>
      <CardFooter className="px-4 py-4 flex items-center space-x-8">
        <button 
          onClick={handleLike}
          className={`group/like flex items-center space-x-2 text-sm font-bold transition-all ${isLiked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500'}`}
        >
          <div className={`p-2 rounded-full transition-colors ${isLiked ? 'bg-rose-50' : 'group-hover/like:bg-rose-50'}`}>
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
          </div>
          <span>{post.likesCount}</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="group/comment flex items-center space-x-2 text-sm font-bold text-muted-foreground hover:text-primary transition-all"
        >
          <div className="p-2 rounded-full group-hover/comment:bg-primary/5 transition-colors">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span>{post.commentsCount}</span>
        </button>
      </CardFooter>
      
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <Separator className="mx-4 w-auto" />
            <div className="p-4 space-y-4">
              <form onSubmit={handleComment} className="flex space-x-2">
                <Input 
                  placeholder="Write a comment..." 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="sm" disabled={!newComment.trim()}>Post</Button>
              </form>
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={comment.authorPhoto} referrerPolicy="no-referrer" />
                      <AvatarFallback>{comment.authorName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-muted/50 rounded-2xl px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{comment.authorName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate()) : 'now'}
                        </span>
                      </div>
                      <p className="text-xs">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

const CreatePost: React.FC = () => {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handlePost = async () => {
    if (!content.trim() || !profile) return;
    setIsPosting(true);
    try {
      await postService.createPost(content, profile);
      setContent('');
      toast.success('Post shared!');
    } catch (e) {
      toast.error('Failed to share post');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card className="mb-6 border-none shadow-lg bg-white/80 backdrop-blur-xl ring-1 ring-primary/5">
      <CardContent className="p-6">
        <div className="flex space-x-4">
          <Avatar className="h-12 w-12 ring-2 ring-primary/10">
            <AvatarImage src={profile?.photoURL} referrerPolicy="no-referrer" />
            <AvatarFallback className="bg-primary/5 text-primary font-bold">{profile?.displayName?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-4">
            <Textarea 
              placeholder="What's on your mind?" 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none border-none focus-visible:ring-0 text-xl p-0 bg-transparent placeholder:text-muted-foreground/40 font-medium"
              maxLength={280}
            />
            <div className="flex items-center justify-between border-t border-primary/5 pt-4">
              <div className="flex items-center space-x-2">
                <div className={`h-1.5 w-1.5 rounded-full ${content.length > 250 ? 'bg-rose-500 animate-pulse' : 'bg-primary/40'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${content.length > 250 ? 'text-rose-500' : 'text-muted-foreground/60'}`}>
                  {content.length} / 280
                </span>
              </div>
              <Button 
                onClick={handlePost} 
                disabled={!content.trim() || isPosting}
                className="rounded-full px-8 h-10 font-bold shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/80"
              >
                {isPosting ? 'Posting...' : 'Share Post'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Feed: React.FC<{ type: 'global' | 'following' }> = ({ type }) => {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (type === 'following' && profile) {
      const q = query(collection(db, 'follows'), where('followerId', '==', profile.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setFollowingIds(snapshot.docs.map(doc => doc.data().followingId));
      });
      return () => unsubscribe();
    }
  }, [type, profile]);

  useEffect(() => {
    let q;
    if (type === 'global') {
      q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    } else if (type === 'following' && profile) {
      if (followingIds.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      // Firestore 'in' query limit is 10, but for simplicity we'll just show global if following is empty
      // or implement a better following feed logic.
      q = query(
        collection(db, 'posts'), 
        where('authorId', 'in', followingIds.slice(0, 10)), 
        orderBy('createdAt', 'desc'), 
        limit(50)
      );
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [type, profile, followingIds]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading feed...</div>;

  return (
    <div className="space-y-4">
      {posts.length === 0 ? (
        <div className="p-12 text-center bg-white/50 rounded-2xl border border-dashed">
          <p className="text-muted-foreground">No posts yet. Start following people or share your first post!</p>
        </div>
      ) : (
        posts.map(post => <PostCard key={post.id} post={post} currentUserId={profile?.uid || ''} />)
      )}
    </div>
  );
};

const SearchPage: React.FC = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [postResults, setPostResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const search = async () => {
      if (!searchTerm.trim()) {
        setUserResults([]);
        setPostResults([]);
        return;
      }
      setLoading(true);
      try {
        // Search Users
        const uq = query(
          collection(db, 'users'), 
          where('displayName', '>=', searchTerm),
          where('displayName', '<=', searchTerm + '\uf8ff'),
          limit(5)
        );
        const uSnapshot = await getDocs(uq);
        setUserResults(uSnapshot.docs.map(doc => doc.data() as UserProfile).filter(u => u.uid !== profile?.uid));

        // Search Posts
        const pq = query(
          collection(db, 'posts'),
          where('content', '>=', searchTerm),
          where('content', '<=', searchTerm + '\uf8ff'),
          limit(5)
        );
        const pSnapshot = await getDocs(pq);
        setPostResults(pSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, profile]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search users or posts..." 
          className="pl-10 h-12 rounded-full bg-white/80 backdrop-blur-sm border-none shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="text-center p-4">Searching...</div>
        ) : (
          <>
            {userResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground px-2">Users</h3>
                {userResults.map(user => (
                  <Card key={user.uid} className="border-none shadow-sm hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.photoURL} referrerPolicy="no-referrer" />
                          <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold">{user.displayName}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-1">{user.bio || 'No bio yet'}</p>
                        </div>
                      </div>
                      <FollowButton targetUserId={user.uid} targetUserName={user.displayName} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {postResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-muted-foreground px-2">Posts</h3>
                {postResults.map(post => (
                  <PostCard key={post.id} post={post} currentUserId={profile?.uid || ''} />
                ))}
              </div>
            )}

            {searchTerm && userResults.length === 0 && postResults.length === 0 && (
              <div className="text-center p-8 text-muted-foreground">No results found matching "{searchTerm}"</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const FollowButton: React.FC<{ targetUserId: string; targetUserName: string }> = ({ targetUserId, targetUserName }) => {
  const { profile } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const followId = `${profile.uid}_${targetUserId}`;
    const unsubscribe = onSnapshot(doc(db, 'follows', followId), (doc) => {
      setIsFollowing(doc.exists());
    });
    return () => unsubscribe();
  }, [profile, targetUserId]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;
    try {
      await followService.toggleFollow(profile.uid, targetUserId, profile.displayName);
    } catch (e) {
      toast.error('Failed to follow user');
    }
  };

  return (
    <Button 
      variant={isFollowing ? "outline" : "default"} 
      size="sm" 
      className="rounded-full px-6"
      onClick={handleFollow}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
};

const NotificationsPage: React.FC = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'), 
      where('recipientId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });
    return () => unsubscribe();
  }, [profile]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="h-4 w-4 text-rose-500 fill-current" />;
      case 'comment': return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'follow': return <Users className="h-4 w-4 text-green-500" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getMessage = (notif: Notification) => {
    switch (notif.type) {
      case 'like': return 'liked your post';
      case 'comment': return 'commented on your post';
      case 'follow': return 'started following you';
      default: return 'sent you a notification';
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold px-2">Notifications</h2>
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No notifications yet.</div>
        ) : (
          notifications.map(notif => (
            <Card key={notif.id} className={`border-none shadow-sm ${notif.read ? 'opacity-70' : 'bg-primary/5'}`}>
              <CardContent className="p-4 flex items-center space-x-4">
                <div className="p-2 rounded-full bg-background shadow-sm">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-bold">{notif.senderName}</span> {getMessage(notif)}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {notif.createdAt ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

const ProfilePage: React.FC = () => {
  const { profile, logout } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    if (!profile) return;
    const q = query(collection(db, 'posts'), where('authorId', '==', profile.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post)));
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    // Get followers count
    const qFollowers = query(collection(db, 'follows'), where('followingId', '==', profile.uid));
    const unsubFollowers = onSnapshot(qFollowers, (snapshot) => {
      setStats(prev => ({ ...prev, followers: snapshot.size }));
    });

    // Get following count
    const qFollowing = query(collection(db, 'follows'), where('followerId', '==', profile.uid));
    const unsubFollowing = onSnapshot(qFollowing, (snapshot) => {
      setStats(prev => ({ ...prev, following: snapshot.size }));
    });

    return () => {
      unsubFollowers();
      unsubFollowing();
    };
  }, [profile]);

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="relative h-48 bg-gradient-to-br from-primary via-primary/80 to-secondary rounded-[2rem] overflow-hidden shadow-lg">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
        <div className="absolute -bottom-16 left-8">
          <Avatar className="h-32 w-32 border-8 border-white shadow-2xl ring-1 ring-black/5">
            <AvatarImage src={profile.photoURL} referrerPolicy="no-referrer" />
            <AvatarFallback className="bg-primary/5 text-primary text-4xl font-black">{profile.displayName[0]}</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="pt-20 px-8 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight">{profile.displayName}</h2>
            <p className="text-sm font-bold text-primary/60 uppercase tracking-widest">{profile.role}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="rounded-full px-6 font-bold hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all">
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>

        <p className="text-base font-medium leading-relaxed max-w-xl text-foreground/80">
          {profile.bio || "No bio added yet. Tell the world about yourself!"}
        </p>

        <div className="flex space-x-8">
          <div className="flex flex-col">
            <span className="text-xl font-black">{stats.following}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Following</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black">{stats.followers}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Followers</span>
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="flex items-center space-x-2 mb-6">
          <div className="h-1 w-8 rounded-full bg-primary" />
          <h3 className="text-lg font-black tracking-tight">Your Posts</h3>
        </div>
        <div className="space-y-4">
          {posts.map(post => <PostCard key={post.id} post={post} currentUserId={profile.uid} />)}
          {posts.length === 0 && (
            <div className="text-center p-16 bg-white/40 rounded-[2rem] border-2 border-dashed border-primary/10">
              <p className="text-muted-foreground font-bold">You haven't shared any stories yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const MainContent: React.FC = () => {
  const { profile, signIn, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('activeTab') || 'home');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'notifications'), 
      where('recipientId', '==', profile.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });
    return () => unsubscribe();
  }, [profile]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-primary font-bold text-2xl"
        >
          Thee Social
        </motion.div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-secondary/10 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-6xl font-black tracking-tighter bg-gradient-to-br from-primary via-primary/80 to-secondary bg-clip-text text-transparent">Thee Social</h1>
            <p className="text-muted-foreground text-lg font-medium">Connect, share, and build your community.</p>
          </div>
          <Card className="border-none shadow-2xl bg-white/40 backdrop-blur-2xl ring-1 ring-white/20">
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-left text-sm">
                <div className="p-4 rounded-2xl bg-primary/10 space-y-2 border border-primary/5">
                  <Users className="h-5 w-5 text-primary" />
                  <p className="font-bold">Build Community</p>
                </div>
                <div className="p-4 rounded-2xl bg-secondary/10 space-y-2 border border-secondary/5">
                  <Heart className="h-5 w-5 text-secondary" />
                  <p className="font-bold">Share Love</p>
                </div>
              </div>
              <Button onClick={signIn} className="w-full h-14 text-lg rounded-full shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.02] transition-transform">
                Sign in with Google
              </Button>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                Secure Authentication via Google
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(at_top_left,_var(--tw-gradient-stops))] from-primary/5 via-[#F7F9FB] to-secondary/5 text-foreground">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[280px_1fr_350px] gap-6 p-4 md:p-6 h-screen overflow-hidden">
        
        {/* Sidebar Navigation */}
        <aside className="hidden md:flex flex-col justify-between py-4">
          <div className="space-y-8">
            <div className="px-4">
              <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Thee Social</h1>
            </div>
            <nav className="space-y-2">
              <NavItem icon={<Home className={activeTab === 'home' ? 'text-primary' : ''} />} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavItem icon={<Search className={activeTab === 'search' ? 'text-primary' : ''} />} label="Search" active={activeTab === 'search'} onClick={() => setActiveTab('search')} />
              <NavItem 
                icon={<Bell className={activeTab === 'notifications' ? 'text-primary' : ''} />} 
                label="Notifications" 
                active={activeTab === 'notifications'} 
                onClick={() => setActiveTab('notifications')} 
                badge={unreadCount > 0 ? unreadCount : undefined}
              />
              <NavItem icon={<User className={activeTab === 'profile' ? 'text-primary' : ''} />} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
            </nav>
            <Dialog>
              <DialogTrigger render={<Button className="w-full rounded-full h-14 text-lg font-bold shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/80 hover:scale-[1.02] transition-transform" />}>
                <div className="flex items-center">
                  <Plus className="mr-2 h-6 w-6" /> Post
                </div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] p-0 border-none bg-transparent shadow-none">
                <CreatePost />
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="px-4 py-4 flex items-center space-x-3 bg-white/60 backdrop-blur-md rounded-3xl shadow-sm border border-white/40">
            <Avatar className="h-10 w-10 ring-2 ring-primary/10">
              <AvatarImage src={profile.photoURL} referrerPolicy="no-referrer" />
              <AvatarFallback>{profile.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{profile.displayName}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/60 truncate">{profile.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => auth.signOut()} className="hover:bg-rose-50 hover:text-rose-500 rounded-full">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </aside>

        {/* Main Feed Area */}
        <main className="flex flex-col h-full overflow-hidden bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-xl shadow-black/5">
          <header className="p-6 border-b border-white/20 bg-white/40 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight capitalize">{activeTab}</h2>
            {activeTab === 'home' && (
              <Tabs defaultValue="global" className="w-auto">
                <TabsList className="bg-primary/5 rounded-full h-10 p-1">
                  <TabsTrigger value="global" className="rounded-full text-xs h-8 px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">Global</TabsTrigger>
                  <TabsTrigger value="following" className="rounded-full text-xs h-8 px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">Following</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </header>
          
          <ScrollArea className="flex-1 px-4 py-6">
            <div className="max-w-2xl mx-auto">
              {activeTab === 'home' && (
                <Tabs defaultValue="global">
                  <TabsContent value="global" className="mt-0">
                    <CreatePost />
                    <Feed type="global" />
                  </TabsContent>
                  <TabsContent value="following" className="mt-0">
                    <Feed type="following" />
                  </TabsContent>
                </Tabs>
              )}
              {activeTab === 'search' && <SearchPage />}
              {activeTab === 'notifications' && <NotificationsPage />}
              {activeTab === 'profile' && <ProfilePage />}
            </div>
          </ScrollArea>
        </main>

        {/* Right Sidebar - Trends/Suggestions */}
        <aside className="hidden lg:flex flex-col space-y-6 overflow-y-auto pr-2">
          <Card className="border-none shadow-sm bg-white/80">
            <CardHeader>
              <CardTitle className="text-lg">Who to follow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SuggestedUser name="Jane Cooper" handle="@janecoop" />
              <SuggestedUser name="Wade Warren" handle="@wadewar" />
              <SuggestedUser name="Esther Howard" handle="@estherh" />
              <Button variant="link" className="p-0 h-auto text-primary text-sm">Show more</Button>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-sm bg-white/80">
            <CardHeader>
              <CardTitle className="text-lg">Trends for you</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TrendItem category="Technology · Trending" title="#TheeSocial" posts="12.5K" />
              <TrendItem category="Sports · Trending" title="Champions League" posts="85.2K" />
              <TrendItem category="Entertainment · Trending" title="New Movie Release" posts="4.2K" />
            </CardContent>
          </Card>
        </aside>

        {/* Mobile Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t flex justify-around py-3 px-4 z-50">
          <MobileNavItem icon={<Home />} active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <MobileNavItem icon={<Search />} active={activeTab === 'search'} onClick={() => setActiveTab('search')} />
          <MobileNavItem icon={<Plus className="bg-primary text-white rounded-full p-1" />} active={false} onClick={() => setActiveTab('home')} />
          <MobileNavItem icon={<Bell />} active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} />
          <MobileNavItem icon={<User />} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
        </nav>
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }> = ({ icon, label, active, onClick, badge }) => (
  <button 
    onClick={onClick}
    className={`flex items-center space-x-4 px-6 py-3.5 rounded-full w-full transition-all duration-300 relative group ${active ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-xl shadow-primary/30 scale-[1.02]' : 'hover:bg-primary/5 text-muted-foreground hover:text-primary hover:translate-x-1'}`}
  >
    <div className="relative">
      {React.cloneElement(icon as React.ReactElement, { className: `h-6 w-6 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}` })}
      {badge !== undefined && (
        <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black h-5 w-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </div>
    <span className="font-black text-lg tracking-tight">{label}</span>
  </button>
);

const MobileNavItem: React.FC<{ icon: React.ReactNode; active: boolean; onClick: () => void }> = ({ icon, active, onClick }) => (
  <button onClick={onClick} className={`p-2 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
    {React.cloneElement(icon as React.ReactElement, { className: "h-6 w-6" })}
  </button>
);

const SuggestedUser: React.FC<{ name: string; handle: string }> = ({ name, handle }) => (
  <div className="flex items-center justify-between group cursor-pointer">
    <div className="flex items-center space-x-3">
      <Avatar className="h-11 w-11 ring-2 ring-primary/5 group-hover:ring-primary/20 transition-all">
        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} />
        <AvatarFallback className="bg-primary/5 text-primary font-bold">{name[0]}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-black group-hover:text-primary transition-colors">{name}</p>
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{handle}</p>
      </div>
    </div>
    <Button variant="outline" size="sm" className="rounded-full h-8 px-4 text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all">Follow</Button>
  </div>
);

const TrendItem: React.FC<{ category: string; title: string; posts: string }> = ({ category, title, posts }) => (
  <div className="space-y-1 cursor-pointer hover:bg-primary/5 p-3 -mx-3 rounded-2xl transition-all group">
    <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">{category}</p>
    <p className="text-sm font-black group-hover:text-primary transition-colors">{title}</p>
    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{posts} Posts</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
