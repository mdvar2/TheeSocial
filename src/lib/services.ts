import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp, 
  updateDoc,
  onSnapshot,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Post, Comment, Notification, Like, Follow, UserProfile } from '../types';

export const postService = {
  async createPost(content: string, user: UserProfile) {
    const postRef = collection(db, 'posts');
    const newPost = {
      authorId: user.uid,
      authorName: user.displayName,
      authorPhoto: user.photoURL,
      content,
      createdAt: serverTimestamp(),
      likesCount: 0,
      commentsCount: 0,
    };
    return await addDoc(postRef, newPost);
  },

  async toggleLike(postId: string, userId: string, authorId: string, authorName: string) {
    const likeId = `${userId}_${postId}`;
    const likeRef = doc(db, 'likes', likeId);
    const postRef = doc(db, 'posts', postId);
    const likeDoc = await getDoc(likeRef);

    const batch = writeBatch(db);

    if (likeDoc.exists()) {
      batch.delete(likeRef);
      batch.update(postRef, { likesCount: increment(-1) });
    } else {
      batch.set(likeRef, {
        userId,
        postId,
        createdAt: serverTimestamp(),
      });
      batch.update(postRef, { likesCount: increment(1) });
      
      // Create notification if not own post
      if (userId !== authorId) {
        const notifRef = collection(db, 'notifications');
        batch.set(doc(notifRef), {
          recipientId: authorId,
          senderId: userId,
          senderName: authorName,
          type: 'like',
          postId,
          createdAt: serverTimestamp(),
          read: false,
        });
      }
    }
    await batch.commit();
  },

  async addComment(postId: string, content: string, user: UserProfile, postAuthorId: string) {
    const commentRef = collection(db, 'posts', postId, 'comments');
    const postRef = doc(db, 'posts', postId);
    
    const batch = writeBatch(db);
    const newCommentRef = doc(commentRef);
    batch.set(newCommentRef, {
      postId,
      authorId: user.uid,
      authorName: user.displayName,
      authorPhoto: user.photoURL,
      content,
      createdAt: serverTimestamp(),
    });
    batch.update(postRef, { commentsCount: increment(1) });

    if (user.uid !== postAuthorId) {
      const notifRef = collection(db, 'notifications');
      batch.set(doc(notifRef), {
        recipientId: postAuthorId,
        senderId: user.uid,
        senderName: user.displayName,
        type: 'comment',
        postId,
        createdAt: serverTimestamp(),
        read: false,
      });
    }
    await batch.commit();
  },

  async deletePost(postId: string) {
    await deleteDoc(doc(db, 'posts', postId));
  }
};

export const followService = {
  async toggleFollow(followerId: string, followingId: string, followerName: string) {
    const followId = `${followerId}_${followingId}`;
    const followRef = doc(db, 'follows', followId);
    const followDoc = await getDoc(followRef);

    if (followDoc.exists()) {
      await deleteDoc(followRef);
    } else {
      const batch = writeBatch(db);
      batch.set(followRef, {
        followerId,
        followingId,
        createdAt: serverTimestamp(),
      });
      
      const notifRef = collection(db, 'notifications');
      batch.set(doc(notifRef), {
        recipientId: followingId,
        senderId: followerId,
        senderName: followerName,
        type: 'follow',
        createdAt: serverTimestamp(),
        read: false,
      });
      await batch.commit();
    }
  }
};
