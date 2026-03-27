"""Backend tests for Agora social media app"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

TEST_EMAIL = "test@agora.com"
TEST_PASSWORD = "password123"
TEST_EMAIL2 = "testuser2_agora@agora.com"
TEST_PASSWORD2 = "password123"


@pytest.fixture(scope="module")
def token():
    """Login and get token for test@agora.com"""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if r.status_code == 200:
        return r.json()["token"]
    # Try registering
    r2 = requests.post(f"{BASE_URL}/api/auth/register", json={
        "username": "testagora", "email": TEST_EMAIL, "password": TEST_PASSWORD, "display_name": "Test Agora"
    })
    assert r2.status_code == 200, f"Could not login or register: {r.text}"
    return r2.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def token2():
    """Second test user token"""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL2, "password": TEST_PASSWORD2})
    if r.status_code == 200:
        return r.json()["token"]
    r2 = requests.post(f"{BASE_URL}/api/auth/register", json={
        "username": "testagora2", "email": TEST_EMAIL2, "password": TEST_PASSWORD2, "display_name": "Test Agora 2"
    })
    assert r2.status_code == 200, f"Could not register second user: {r2.text}"
    return r2.json()["token"]


# ===== AUTH TESTS =====

class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_get_me(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "username" in data

    def test_register_duplicate_email(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "username": "brandnew999", "email": TEST_EMAIL, "password": "pass", "display_name": "Dup"
        })
        assert r.status_code == 400


# ===== FEED TESTS =====

class TestFeed:
    def test_for_you_feed(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/feed?type=for_you", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_following_feed(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/feed?type=following", headers=auth_headers)
        assert r.status_code in [200]
        assert isinstance(r.json(), list)

    def test_feed_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/feed")
        assert r.status_code == 401


# ===== POSTS TESTS =====

class TestPosts:
    created_post_id = None

    def test_create_post(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/posts", json={"content": "TEST_ Hello Agora! #testing"}, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert data["content"] == "TEST_ Hello Agora! #testing"
        assert "testing" in data["hashtags"]
        TestPosts.created_post_id = data["id"]

    def test_get_post(self, auth_headers):
        assert TestPosts.created_post_id
        r = requests.get(f"{BASE_URL}/api/posts/{TestPosts.created_post_id}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == TestPosts.created_post_id

    def test_like_post(self, auth_headers):
        assert TestPosts.created_post_id
        r = requests.post(f"{BASE_URL}/api/posts/{TestPosts.created_post_id}/like", headers=auth_headers)
        assert r.status_code == 200
        assert "liked" in r.json()

    def test_unlike_post(self, auth_headers):
        assert TestPosts.created_post_id
        # Toggle again
        r = requests.post(f"{BASE_URL}/api/posts/{TestPosts.created_post_id}/like", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["liked"] == False

    def test_repost(self, auth_headers):
        assert TestPosts.created_post_id
        r = requests.post(f"{BASE_URL}/api/posts/{TestPosts.created_post_id}/repost", headers=auth_headers)
        assert r.status_code == 200
        # Toggle back
        requests.post(f"{BASE_URL}/api/posts/{TestPosts.created_post_id}/repost", headers=auth_headers)

    def test_bookmark(self, auth_headers):
        assert TestPosts.created_post_id
        r = requests.post(f"{BASE_URL}/api/posts/{TestPosts.created_post_id}/bookmark", headers=auth_headers)
        assert r.status_code == 200
        assert "bookmarked" in r.json()
        # Toggle back
        requests.post(f"{BASE_URL}/api/posts/{TestPosts.created_post_id}/bookmark", headers=auth_headers)

    def test_reply_to_post(self, auth_headers):
        assert TestPosts.created_post_id
        r = requests.post(f"{BASE_URL}/api/posts", json={
            "content": "TEST_ reply to post", "reply_to": TestPosts.created_post_id
        }, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["is_reply"] == True
        assert data["reply_to"] == TestPosts.created_post_id

    def test_get_replies(self, auth_headers):
        assert TestPosts.created_post_id
        r = requests.get(f"{BASE_URL}/api/posts/{TestPosts.created_post_id}/replies", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_delete_post(self, auth_headers):
        # Create a post then delete it
        r = requests.post(f"{BASE_URL}/api/posts", json={"content": "TEST_ to delete"}, headers=auth_headers)
        post_id = r.json()["id"]
        rd = requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=auth_headers)
        assert rd.status_code == 200
        assert rd.json()["success"] == True


# ===== USERS TESTS =====

class TestUsers:
    def test_get_user_profile(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/users/testagora", headers=auth_headers)
        if r.status_code == 404:
            # try the actual registered username
            me = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers).json()
            username = me["username"]
            r = requests.get(f"{BASE_URL}/api/users/{username}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "username" in data

    def test_update_profile(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/users/profile", json={"bio": "TEST_ bio update"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["bio"] == "TEST_ bio update"

    def test_get_suggestions(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/users/suggestions", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_follow_unfollow(self, auth_headers, token2):
        # Get second user's username
        me2 = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token2}"}).json()
        username2 = me2["username"]
        # Follow
        r = requests.post(f"{BASE_URL}/api/users/{username2}/follow", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["following"] == True
        # Unfollow
        r2 = requests.post(f"{BASE_URL}/api/users/{username2}/follow", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["following"] == False


# ===== EXPLORE TESTS =====

class TestExplore:
    def test_trending(self):
        r = requests.get(f"{BASE_URL}/api/explore/trending")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_search(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/explore/search?q=TEST_", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "posts" in data
        assert "users" in data

    def test_search_empty(self):
        r = requests.get(f"{BASE_URL}/api/explore/search?q=")
        assert r.status_code == 200
        data = r.json()
        assert data["posts"] == [] and data["users"] == []


# ===== NOTIFICATIONS TESTS =====

class TestNotifications:
    def test_get_notifications(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unread_count(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=auth_headers)
        assert r.status_code == 200
        assert "count" in r.json()

    def test_mark_read(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/notifications/read", headers=auth_headers)
        assert r.status_code == 200


# ===== BOOKMARKS TESTS =====

class TestBookmarks:
    def test_get_bookmarks(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/bookmarks", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
