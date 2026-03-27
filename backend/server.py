from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Response
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import requests as http_requests
import os
import logging
import uuid
from pathlib import Path
from dotenv import load_dotenv
from bson import ObjectId
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

SECRET_KEY = os.environ.get('JWT_SECRET', 'agora-social-secret-key-2026')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "agora"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===== Storage =====
_storage_key = None

def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    try:
        resp = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        logger.info("Storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = http_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ===== Auth Helpers =====
def hash_password(p: str) -> str:
    return pwd_context.hash(p)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"_id": ObjectId(uid)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_current_user_opt(token: Optional[str] = Depends(oauth2_optional)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            return None
        return await db.users.find_one({"_id": ObjectId(uid)})
    except Exception:
        return None

# ===== Content Helpers =====
def extract_hashtags(content: str) -> List[str]:
    return list(set(tag.lower() for tag in re.findall(r'#(\w+)', content)))

def extract_mentions(content: str) -> List[str]:
    return list(set(m.lower() for m in re.findall(r'@(\w+)', content)))

def validate_username(username: str) -> bool:
    return bool(re.match(r'^[a-zA-Z0-9_]{3,20}$', username))

# ===== Serializers =====
DELETED_USER = {"id": "", "username": "deleted", "display_name": "Deleted User",
                "bio": "", "avatar_url": "", "banner_url": "", "verified": False,
                "followers_count": 0, "following_count": 0, "posts_count": 0, "created_at": ""}

def serialize_user(user: dict, include_email: bool = False) -> dict:
    d = {
        "id": str(user["_id"]),
        "username": user["username"],
        "display_name": user.get("display_name", user["username"]),
        "bio": user.get("bio", ""),
        "avatar_url": user.get("avatar_url", ""),
        "banner_url": user.get("banner_url", ""),
        "verified": user.get("verified", False),
        "followers_count": user.get("followers_count", 0),
        "following_count": user.get("following_count", 0),
        "posts_count": user.get("posts_count", 0),
        "created_at": user["created_at"].isoformat() if isinstance(user["created_at"], datetime) else user.get("created_at", ""),
    }
    if include_email:
        d["email"] = user.get("email", "")
    return d

async def serialize_quoted_post(post_id: str) -> Optional[dict]:
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        return None
    if not post:
        return None
    author = await db.users.find_one({"_id": ObjectId(post["author_id"])})
    return {
        "id": str(post["_id"]),
        "content": post["content"],
        "media_urls": post.get("media_urls", []),
        "created_at": post["created_at"].isoformat() if isinstance(post["created_at"], datetime) else post.get("created_at", ""),
        "author": serialize_user(author) if author else DELETED_USER,
        "content_warning": post.get("content_warning", False),
        "content_warning_label": post.get("content_warning_label", ""),
    }

async def serialize_post(post: dict, current_user_id: Optional[str] = None) -> dict:
    author = await db.users.find_one({"_id": ObjectId(post["author_id"])})
    author_data = serialize_user(author) if author else DELETED_USER
    post_id_str = str(post["_id"])
    liked = reposted = bookmarked = False
    if current_user_id:
        liked = await db.likes.find_one({"user_id": current_user_id, "post_id": post_id_str}) is not None
        reposted = await db.reposts.find_one({"user_id": current_user_id, "post_id": post_id_str}) is not None
        bookmarked = await db.bookmarks.find_one({"user_id": current_user_id, "post_id": post_id_str}) is not None

    quoted = None
    if post.get("quote_of"):
        quoted = await serialize_quoted_post(post["quote_of"])

    return {
        "id": post_id_str,
        "author": author_data,
        "content": post["content"],
        "media_urls": post.get("media_urls", []),
        "hashtags": post.get("hashtags", []),
        "like_count": post.get("like_count", 0),
        "repost_count": post.get("repost_count", 0),
        "reply_count": post.get("reply_count", 0),
        "bookmark_count": post.get("bookmark_count", 0),
        "view_count": post.get("view_count", 0),
        "is_reply": post.get("is_reply", False),
        "reply_to": post.get("reply_to"),
        "is_repost": post.get("is_repost", False),
        "repost_of": post.get("repost_of"),
        "quote_of": post.get("quote_of"),
        "quoted_post": quoted,
        "content_warning": post.get("content_warning", False),
        "content_warning_label": post.get("content_warning_label", ""),
        "thread_id": post.get("thread_id"),
        "thread_position": post.get("thread_position", 0),
        "edited": post.get("edited", False),
        "created_at": post["created_at"].isoformat() if isinstance(post["created_at"], datetime) else post.get("created_at", ""),
        "liked": liked,
        "reposted": reposted,
        "bookmarked": bookmarked,
    }

async def create_notification(recipient_id: str, notif_type: str, from_user_id: str, post_id: Optional[str] = None):
    if recipient_id == from_user_id:
        return
    await db.notifications.insert_one({
        "recipient_id": recipient_id,
        "type": notif_type,
        "from_user_id": from_user_id,
        "post_id": post_id,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    })

# ===== Pydantic Models =====
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: str

class UserLogin(BaseModel):
    email: str
    password: str

class PostCreate(BaseModel):
    content: str
    media_urls: List[str] = []
    reply_to: Optional[str] = None
    quote_of: Optional[str] = None
    content_warning: bool = False
    content_warning_label: str = ""
    thread_id: Optional[str] = None

class PostEdit(BaseModel):
    content: str

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None

class DMSend(BaseModel):
    content: str

# ===== STARTUP =====
@app.on_event("startup")
async def startup():
    init_storage()
    # Create indexes
    await db.posts.create_index([("created_at", -1)])
    await db.posts.create_index([("author_id", 1)])
    await db.posts.create_index([("hashtags", 1)])
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)])
    await db.notifications.create_index([("recipient_id", 1), ("created_at", -1)])
    await db.dms_messages.create_index([("conversation_id", 1), ("created_at", 1)])

# ===== AUTH =====
@api_router.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, data: UserCreate):
    if not validate_username(data.username):
        raise HTTPException(400, "Username must be 3-20 chars, letters/numbers/underscore only")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if len(data.display_name.strip()) < 1:
        raise HTTPException(400, "Display name is required")
    if await db.users.find_one({"username": data.username.lower()}):
        raise HTTPException(400, "Username already taken")
    if await db.users.find_one({"email": data.email.lower()}):
        raise HTTPException(400, "Email already registered")

    user_doc = {
        "username": data.username.lower(),
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "display_name": data.display_name.strip(),
        "bio": "",
        "avatar_url": "",
        "banner_url": "",
        "verified": False,
        "followers_count": 0,
        "following_count": 0,
        "posts_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    token = create_token(str(result.inserted_id))
    return {"token": token, "user": serialize_user(user_doc, include_email=True)}

@api_router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(str(user["_id"]))
    return {"token": token, "user": serialize_user(user, include_email=True)}

@api_router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return serialize_user(current_user, include_email=True)

# ===== FEED =====
@api_router.get("/feed")
async def get_feed(
    type: str = Query("for_you", enum=["for_you", "following"]),
    skip: int = 0,
    limit: int = 20,
    current_user=Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    query = {"is_reply": False}
    if type == "following":
        follows = await db.follows.find({"follower_id": user_id}).to_list(1000)
        following_ids = [f["following_id"] for f in follows]
        if not following_ids:
            return []
        query["author_id"] = {"$in": following_ids}
    posts = await db.posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return [await serialize_post(p, user_id) for p in posts]

# ===== POSTS =====
@api_router.post("/posts")
@limiter.limit("30/minute")
async def create_post(request: Request, data: PostCreate, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    content = data.content.strip()
    if not content:
        raise HTTPException(400, "Content cannot be empty")
    if len(content) > 500:
        raise HTTPException(400, "Post too long (max 500 chars)")

    hashtags = extract_hashtags(content)
    mentions = extract_mentions(content)

    if data.reply_to:
        parent = await db.posts.find_one({"_id": ObjectId(data.reply_to)})
        if not parent:
            raise HTTPException(404, "Parent post not found")
    if data.quote_of:
        quoted = await db.posts.find_one({"_id": ObjectId(data.quote_of)})
        if not quoted:
            raise HTTPException(404, "Quoted post not found")

    post_doc = {
        "author_id": user_id,
        "content": content,
        "media_urls": data.media_urls,
        "hashtags": hashtags,
        "like_count": 0,
        "repost_count": 0,
        "reply_count": 0,
        "bookmark_count": 0,
        "view_count": 0,
        "is_reply": data.reply_to is not None,
        "reply_to": data.reply_to,
        "is_repost": False,
        "repost_of": None,
        "quote_of": data.quote_of,
        "content_warning": data.content_warning,
        "content_warning_label": data.content_warning_label,
        "thread_id": data.thread_id,
        "thread_position": 0,
        "edited": False,
        "edit_history": [],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.posts.insert_one(post_doc)
    post_doc["_id"] = result.inserted_id
    post_id_str = str(result.inserted_id)

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"posts_count": 1}})

    if data.reply_to:
        await db.posts.update_one({"_id": ObjectId(data.reply_to)}, {"$inc": {"reply_count": 1}})
        if parent:
            await create_notification(parent["author_id"], "reply", user_id, data.reply_to)

    if data.quote_of and quoted:
        await create_notification(quoted["author_id"], "quote", user_id, data.quote_of)

    # @mention notifications
    for mention_username in mentions:
        mentioned_user = await db.users.find_one({"username": mention_username})
        if mentioned_user:
            await create_notification(str(mentioned_user["_id"]), "mention", user_id, post_id_str)

    return await serialize_post(post_doc, user_id)

@api_router.get("/posts/{post_id}")
async def get_post(post_id: str, current_user=Depends(get_current_user_opt)):
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        raise HTTPException(400, "Invalid post ID")
    if not post:
        raise HTTPException(404, "Post not found")
    # Increment view count
    await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"view_count": 1}})
    post["view_count"] = post.get("view_count", 0) + 1
    uid = str(current_user["_id"]) if current_user else None
    return await serialize_post(post, uid)

@api_router.put("/posts/{post_id}")
async def edit_post(post_id: str, data: PostEdit, current_user=Depends(get_current_user)):
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    user_id = str(current_user["_id"])
    if post["author_id"] != user_id:
        raise HTTPException(403, "Not authorized")
    content = data.content.strip()
    if not content:
        raise HTTPException(400, "Content cannot be empty")
    if len(content) > 500:
        raise HTTPException(400, "Post too long (max 500 chars)")

    history_entry = {
        "content": post["content"],
        "edited_at": datetime.now(timezone.utc).isoformat(),
    }
    new_hashtags = extract_hashtags(content)
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": {
            "content": content,
            "hashtags": new_hashtags,
            "edited": True,
        }, "$push": {"edit_history": history_entry}},
    )
    updated = await db.posts.find_one({"_id": ObjectId(post_id)})
    return await serialize_post(updated, user_id)

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user=Depends(get_current_user)):
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    user_id = str(current_user["_id"])
    if post["author_id"] != user_id:
        raise HTTPException(403, "Not authorized")
    await db.posts.delete_one({"_id": ObjectId(post_id)})
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$inc": {"posts_count": -1}})
    return {"success": True}

@api_router.post("/posts/{post_id}/like")
@limiter.limit("60/minute")
async def toggle_like(request: Request, post_id: str, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    existing = await db.likes.find_one({"user_id": user_id, "post_id": post_id})
    if existing:
        await db.likes.delete_one({"user_id": user_id, "post_id": post_id})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"like_count": -1}})
        return {"liked": False}
    else:
        await db.likes.insert_one({"user_id": user_id, "post_id": post_id, "created_at": datetime.now(timezone.utc)})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"like_count": 1}})
        await create_notification(post["author_id"], "like", user_id, post_id)
        return {"liked": True}

@api_router.post("/posts/{post_id}/repost")
@limiter.limit("30/minute")
async def toggle_repost(request: Request, post_id: str, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    existing = await db.reposts.find_one({"user_id": user_id, "post_id": post_id})
    if existing:
        await db.reposts.delete_one({"user_id": user_id, "post_id": post_id})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"repost_count": -1}})
        return {"reposted": False}
    else:
        await db.reposts.insert_one({"user_id": user_id, "post_id": post_id, "created_at": datetime.now(timezone.utc)})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"repost_count": 1}})
        await create_notification(post["author_id"], "repost", user_id, post_id)
        return {"reposted": True}

@api_router.post("/posts/{post_id}/bookmark")
async def toggle_bookmark(post_id: str, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(404, "Post not found")
    existing = await db.bookmarks.find_one({"user_id": user_id, "post_id": post_id})
    if existing:
        await db.bookmarks.delete_one({"user_id": user_id, "post_id": post_id})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"bookmark_count": -1}})
        return {"bookmarked": False}
    else:
        await db.bookmarks.insert_one({"user_id": user_id, "post_id": post_id, "created_at": datetime.now(timezone.utc)})
        await db.posts.update_one({"_id": ObjectId(post_id)}, {"$inc": {"bookmark_count": 1}})
        return {"bookmarked": True}

@api_router.get("/posts/{post_id}/replies")
async def get_replies(post_id: str, current_user=Depends(get_current_user_opt)):
    replies = await db.posts.find({"reply_to": post_id, "is_reply": True}).sort("created_at", 1).to_list(100)
    uid = str(current_user["_id"]) if current_user else None
    return [await serialize_post(r, uid) for r in replies]

# ===== HASHTAG FEED =====
@api_router.get("/hashtag/{tag}")
async def get_hashtag_feed(tag: str, skip: int = 0, limit: int = 20, current_user=Depends(get_current_user_opt)):
    posts = await db.posts.find(
        {"hashtags": tag.lower()}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    uid = str(current_user["_id"]) if current_user else None
    return [await serialize_post(p, uid) for p in posts]

# ===== USERS =====
@api_router.get("/users/suggestions")
async def get_suggestions(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    follows = await db.follows.find({"follower_id": user_id}).to_list(1000)
    following_ids = [f["following_id"] for f in follows] + [user_id]
    users = await db.users.find(
        {"_id": {"$nin": [ObjectId(uid) for uid in following_ids]}}
    ).limit(5).to_list(5)
    return [serialize_user(u) for u in users]

@api_router.get("/users/{username}")
async def get_user_profile(username: str, current_user=Depends(get_current_user_opt)):
    user = await db.users.find_one({"username": username.lower()})
    if not user:
        raise HTTPException(404, "User not found")
    user_data = serialize_user(user)
    if current_user:
        uid = str(current_user["_id"])
        user_data["is_following"] = await db.follows.find_one({
            "follower_id": uid, "following_id": str(user["_id"])
        }) is not None
        user_data["is_me"] = uid == str(user["_id"])
    else:
        user_data["is_following"] = False
        user_data["is_me"] = False
    return user_data

@api_router.get("/users/{username}/posts")
async def get_user_posts(username: str, skip: int = 0, current_user=Depends(get_current_user_opt)):
    user = await db.users.find_one({"username": username.lower()})
    if not user:
        raise HTTPException(404, "User not found")
    posts = await db.posts.find(
        {"author_id": str(user["_id"]), "is_reply": False}
    ).sort("created_at", -1).skip(skip).limit(20).to_list(20)
    uid = str(current_user["_id"]) if current_user else None
    return [await serialize_post(p, uid) for p in posts]

@api_router.get("/users/{username}/replies")
async def get_user_replies(username: str, skip: int = 0, current_user=Depends(get_current_user_opt)):
    user = await db.users.find_one({"username": username.lower()})
    if not user:
        raise HTTPException(404, "User not found")
    posts = await db.posts.find(
        {"author_id": str(user["_id"]), "is_reply": True}
    ).sort("created_at", -1).skip(skip).limit(20).to_list(20)
    uid = str(current_user["_id"]) if current_user else None
    return [await serialize_post(p, uid) for p in posts]

@api_router.get("/users/{username}/likes")
async def get_user_liked_posts(username: str, skip: int = 0, current_user=Depends(get_current_user_opt)):
    user = await db.users.find_one({"username": username.lower()})
    if not user:
        raise HTTPException(404, "User not found")
    liked_docs = await db.likes.find({"user_id": str(user["_id"])}).sort("created_at", -1).skip(skip).limit(20).to_list(20)
    post_ids = [ObjectId(l["post_id"]) for l in liked_docs]
    if not post_ids:
        return []
    posts = await db.posts.find({"_id": {"$in": post_ids}}).to_list(20)
    uid = str(current_user["_id"]) if current_user else None
    return [await serialize_post(p, uid) for p in posts]

@api_router.put("/users/profile")
async def update_profile(data: ProfileUpdate, current_user=Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"_id": current_user["_id"]}, {"$set": update})
    updated = await db.users.find_one({"_id": current_user["_id"]})
    return serialize_user(updated, include_email=True)

@api_router.post("/users/{username}/follow")
async def toggle_follow(username: str, current_user=Depends(get_current_user)):
    target = await db.users.find_one({"username": username.lower()})
    if not target:
        raise HTTPException(404, "User not found")
    follower_id = str(current_user["_id"])
    following_id = str(target["_id"])
    if follower_id == following_id:
        raise HTTPException(400, "Cannot follow yourself")
    existing = await db.follows.find_one({"follower_id": follower_id, "following_id": following_id})
    if existing:
        await db.follows.delete_one({"follower_id": follower_id, "following_id": following_id})
        await db.users.update_one({"_id": current_user["_id"]}, {"$inc": {"following_count": -1}})
        await db.users.update_one({"_id": target["_id"]}, {"$inc": {"followers_count": -1}})
        return {"following": False}
    else:
        await db.follows.insert_one({"follower_id": follower_id, "following_id": following_id, "created_at": datetime.now(timezone.utc)})
        await db.users.update_one({"_id": current_user["_id"]}, {"$inc": {"following_count": 1}})
        await db.users.update_one({"_id": target["_id"]}, {"$inc": {"followers_count": 1}})
        await create_notification(following_id, "follow", follower_id)
        return {"following": True}

# ===== EXPLORE =====
@api_router.get("/explore/trending")
async def get_trending():
    since = datetime.now(timezone.utc) - timedelta(days=7)
    posts = await db.posts.find({"created_at": {"$gte": since}, "hashtags": {"$ne": []}}).to_list(1000)
    counts: dict = {}
    for post in posts:
        for tag in post.get("hashtags", []):
            counts[tag] = counts.get(tag, 0) + 1
    trending = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:10]
    return [{"tag": t[0], "count": t[1]} for t in trending]

@api_router.get("/explore/search")
async def search(q: str = "", current_user=Depends(get_current_user_opt)):
    if not q:
        return {"posts": [], "users": []}
    uid = str(current_user["_id"]) if current_user else None
    posts = await db.posts.find({"content": {"$regex": q, "$options": "i"}}).sort("created_at", -1).limit(20).to_list(20)
    users = await db.users.find(
        {"$or": [
            {"username": {"$regex": q, "$options": "i"}},
            {"display_name": {"$regex": q, "$options": "i"}},
        ]}
    ).limit(5).to_list(5)
    return {
        "posts": [await serialize_post(p, uid) for p in posts],
        "users": [serialize_user(u) for u in users],
    }

# ===== NOTIFICATIONS =====
@api_router.get("/notifications")
async def get_notifications(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    notifs = await db.notifications.find({"recipient_id": user_id}).sort("created_at", -1).limit(50).to_list(50)
    result = []
    for n in notifs:
        from_user = await db.users.find_one({"_id": ObjectId(n["from_user_id"])})
        result.append({
            "id": str(n["_id"]),
            "type": n["type"],
            "from_user": serialize_user(from_user) if from_user else None,
            "post_id": n.get("post_id"),
            "read": n.get("read", False),
            "created_at": n["created_at"].isoformat() if isinstance(n["created_at"], datetime) else n.get("created_at", ""),
        })
    return result

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    count = await db.notifications.count_documents({"recipient_id": user_id, "read": False})
    return {"count": count}

@api_router.put("/notifications/read")
async def mark_notifications_read(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    await db.notifications.update_many({"recipient_id": user_id, "read": False}, {"$set": {"read": True}})
    return {"success": True}

# ===== BOOKMARKS =====
@api_router.get("/bookmarks")
async def get_bookmarks(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    bookmarks = await db.bookmarks.find({"user_id": user_id}).sort("created_at", -1).limit(50).to_list(50)
    post_ids = [ObjectId(b["post_id"]) for b in bookmarks]
    if not post_ids:
        return []
    posts = await db.posts.find({"_id": {"$in": post_ids}}).to_list(50)
    return [await serialize_post(p, user_id) for p in posts]

# ===== UPLOAD =====
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

@api_router.post("/upload")
@limiter.limit("20/minute")
async def upload_file(request: Request, file: UploadFile = File(...), current_user=Depends(get_current_user)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only JPEG, PNG, GIF, WEBP images allowed")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    ext = (file.filename or "image.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{str(current_user['_id'])}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, file.content_type)
        return {"path": result["path"]}
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(500, "Upload failed")

@api_router.get("/files/{path:path}")
async def get_file(path: str):
    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=content_type)
    except Exception:
        raise HTTPException(404, "File not found")

# ===== DIRECT MESSAGES =====
@api_router.get("/dms")
async def get_conversations(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    convs = await db.dms_conversations.find(
        {"participants": user_id}
    ).sort("last_message_at", -1).to_list(50)
    result = []
    for c in convs:
        other_id = next((p for p in c["participants"] if p != user_id), None)
        other_user = await db.users.find_one({"_id": ObjectId(other_id)}) if other_id else None
        unread = await db.dms_messages.count_documents({
            "conversation_id": str(c["_id"]),
            "sender_id": {"$ne": user_id},
            "read": False,
        })
        result.append({
            "id": str(c["_id"]),
            "other_user": serialize_user(other_user) if other_user else None,
            "last_message": c.get("last_message", ""),
            "last_message_at": c["last_message_at"].isoformat() if isinstance(c.get("last_message_at"), datetime) else c.get("last_message_at", ""),
            "unread_count": unread,
        })
    return result

@api_router.get("/dms/unread-count")
async def get_dm_unread_count(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    convs = await db.dms_conversations.find({"participants": user_id}).to_list(100)
    total = 0
    for c in convs:
        count = await db.dms_messages.count_documents({
            "conversation_id": str(c["_id"]),
            "sender_id": {"$ne": user_id},
            "read": False,
        })
        total += count
    return {"count": total}

@api_router.post("/dms/{username}/send")
@limiter.limit("30/minute")
async def send_dm(request: Request, username: str, data: DMSend, current_user=Depends(get_current_user)):
    target = await db.users.find_one({"username": username.lower()})
    if not target:
        raise HTTPException(404, "User not found")
    sender_id = str(current_user["_id"])
    recipient_id = str(target["_id"])
    if sender_id == recipient_id:
        raise HTTPException(400, "Cannot message yourself")
    # Find or create conversation
    conv = await db.dms_conversations.find_one({
        "participants": {"$all": [sender_id, recipient_id]}
    })
    if not conv:
        res = await db.dms_conversations.insert_one({
            "participants": [sender_id, recipient_id],
            "last_message": data.content[:50],
            "last_message_at": datetime.now(timezone.utc),
        })
        conv_id = str(res.inserted_id)
    else:
        conv_id = str(conv["_id"])
        await db.dms_conversations.update_one(
            {"_id": conv["_id"]},
            {"$set": {"last_message": data.content[:50], "last_message_at": datetime.now(timezone.utc)}},
        )
    msg = {
        "conversation_id": conv_id,
        "sender_id": sender_id,
        "content": data.content,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.dms_messages.insert_one(msg)
    msg["_id"] = result.inserted_id
    return {
        "id": str(msg["_id"]),
        "conversation_id": conv_id,
        "sender_id": sender_id,
        "content": data.content,
        "read": False,
        "created_at": msg["created_at"].isoformat(),
    }

@api_router.get("/dms/{conv_id}/messages")
async def get_messages(conv_id: str, skip: int = 0, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    conv = await db.dms_conversations.find_one({"_id": ObjectId(conv_id)})
    if not conv or user_id not in conv["participants"]:
        raise HTTPException(403, "Not authorized")
    msgs = await db.dms_messages.find({"conversation_id": conv_id}).sort("created_at", 1).skip(skip).limit(50).to_list(50)
    # Mark as read
    await db.dms_messages.update_many(
        {"conversation_id": conv_id, "sender_id": {"$ne": user_id}, "read": False},
        {"$set": {"read": True}},
    )
    return [{
        "id": str(m["_id"]),
        "sender_id": m["sender_id"],
        "content": m["content"],
        "read": m.get("read", False),
        "created_at": m["created_at"].isoformat() if isinstance(m["created_at"], datetime) else m.get("created_at", ""),
    } for m in msgs]

# ===== INCLUDE ROUTER =====
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
