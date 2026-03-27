"""
Backend tests for Agora P0-P2 features:
- Post editing, quote posts, hashtag feed, content warnings
- DM conversations, image upload, notifications, view counts
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

TEST_EMAIL = "test@agora.com"
TEST_PASSWORD = "password123"
TEST_EMAIL2 = "testuser2_agora@agora.com"


@pytest.fixture(scope="module")
def token():
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert res.status_code == 200
    return res.json()["token"]

@pytest.fixture(scope="module")
def token2():
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL2, "password": TEST_PASSWORD})
    if res.status_code == 200:
        return res.json()["token"]
    # Register if not exists
    res = requests.post(f"{BASE_URL}/api/auth/register", json={
        "username": "testagora2",
        "email": TEST_EMAIL2,
        "password": TEST_PASSWORD,
        "display_name": "Test Agora 2"
    })
    return res.json()["token"]

@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="module")
def auth_headers2(token2):
    return {"Authorization": f"Bearer {token2}"}


class TestPostEdit:
    """Post editing endpoint tests"""

    def test_create_post_for_edit(self, auth_headers):
        res = requests.post(f"{BASE_URL}/api/posts", json={"content": "TEST_edit_original #testing"}, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["content"] == "TEST_edit_original #testing"
        assert "edited" in data
        assert data["edited"] == False
        TestPostEdit.post_id = data["id"]

    def test_edit_post_content(self, auth_headers):
        res = requests.put(
            f"{BASE_URL}/api/posts/{TestPostEdit.post_id}",
            json={"content": "TEST_edit_updated #testing #edited"},
            headers=auth_headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["content"] == "TEST_edit_updated #testing #edited"
        assert data["edited"] == True
        assert "edited" in data["hashtags"]

    def test_edit_extracts_hashtags(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/posts/{TestPostEdit.post_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "edited" in data["hashtags"]
        assert data["edited"] == True

    def test_edit_unauthorized(self, auth_headers2):
        res = requests.put(
            f"{BASE_URL}/api/posts/{TestPostEdit.post_id}",
            json={"content": "hacker content"},
            headers=auth_headers2
        )
        assert res.status_code == 403

    def test_cleanup_edited_post(self, auth_headers):
        requests.delete(f"{BASE_URL}/api/posts/{TestPostEdit.post_id}", headers=auth_headers)


class TestQuotePosts:
    """Quote post tests"""

    def test_create_original_post(self, auth_headers):
        res = requests.post(f"{BASE_URL}/api/posts", json={"content": "TEST_original post to quote"}, headers=auth_headers)
        assert res.status_code == 200
        TestQuotePosts.original_id = res.json()["id"]

    def test_create_quote_post(self, auth_headers):
        res = requests.post(f"{BASE_URL}/api/posts", json={
            "content": "TEST_quoting this post",
            "quote_of": TestQuotePosts.original_id
        }, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["quote_of"] == TestQuotePosts.original_id
        assert data["quoted_post"] is not None
        assert data["quoted_post"]["id"] == TestQuotePosts.original_id
        TestQuotePosts.quote_id = data["id"]

    def test_quoted_post_has_author(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/posts/{TestQuotePosts.quote_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["quoted_post"]["author"] is not None
        assert "username" in data["quoted_post"]["author"]

    def test_cleanup(self, auth_headers):
        requests.delete(f"{BASE_URL}/api/posts/{TestQuotePosts.quote_id}", headers=auth_headers)
        requests.delete(f"{BASE_URL}/api/posts/{TestQuotePosts.original_id}", headers=auth_headers)


class TestContentWarning:
    """Content warning in posts"""

    def test_create_post_with_cw(self, auth_headers):
        res = requests.post(f"{BASE_URL}/api/posts", json={
            "content": "TEST_sensitive content here",
            "content_warning": True,
            "content_warning_label": "Sensitive stuff"
        }, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["content_warning"] == True
        assert data["content_warning_label"] == "Sensitive stuff"
        TestContentWarning.post_id = data["id"]

    def test_cw_persists_on_get(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/posts/{TestContentWarning.post_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["content_warning"] == True
        assert data["content_warning_label"] == "Sensitive stuff"

    def test_cleanup(self, auth_headers):
        requests.delete(f"{BASE_URL}/api/posts/{TestContentWarning.post_id}", headers=auth_headers)


class TestHashtagFeed:
    """Hashtag feed endpoint"""

    def test_create_post_with_hashtag(self, auth_headers):
        res = requests.post(f"{BASE_URL}/api/posts", json={"content": "TEST_hashtag feed post #testhashtag2026"}, headers=auth_headers)
        assert res.status_code == 200
        TestHashtagFeed.post_id = res.json()["id"]

    def test_hashtag_feed_returns_posts(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/hashtag/testhashtag2026")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert any(p["id"] == TestHashtagFeed.post_id for p in data)

    def test_hashtag_feed_pagination(self):
        res = requests.get(f"{BASE_URL}/api/hashtag/testhashtag2026", params={"skip": 0, "limit": 5})
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_hashtag_feed_empty(self):
        res = requests.get(f"{BASE_URL}/api/hashtag/nonexistenthashtag99999")
        assert res.status_code == 200
        assert res.json() == []

    def test_cleanup(self, auth_headers):
        requests.delete(f"{BASE_URL}/api/posts/{TestHashtagFeed.post_id}", headers=auth_headers)


class TestViewCount:
    """View count increments on post detail access"""

    def test_view_count_increments(self, auth_headers):
        res = requests.post(f"{BASE_URL}/api/posts", json={"content": "TEST_view count post"}, headers=auth_headers)
        assert res.status_code == 200
        post_id = res.json()["id"]
        initial_views = res.json().get("view_count", 0)

        # Access the post detail
        res2 = requests.get(f"{BASE_URL}/api/posts/{post_id}")
        assert res2.status_code == 200
        assert res2.json()["view_count"] > initial_views

        requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=auth_headers)


class TestDirectMessages:
    """DM endpoint tests"""

    def test_send_dm(self, auth_headers, auth_headers2):
        # Get user2 info to know their username
        me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers2)
        assert me2.status_code == 200
        username2 = me2.json()["username"]

        res = requests.post(
            f"{BASE_URL}/api/dms/{username2}/send",
            json={"content": "TEST_hello DM"},
            headers=auth_headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["content"] == "TEST_hello DM"
        assert "conversation_id" in data
        TestDirectMessages.conv_id = data["conversation_id"]

    def test_get_conversations(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/dms", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        conv = next((c for c in data if c["id"] == TestDirectMessages.conv_id), None)
        assert conv is not None
        assert conv["other_user"] is not None
        assert "last_message" in conv

    def test_get_messages(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/dms/{TestDirectMessages.conv_id}/messages", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert data[0]["content"] == "TEST_hello DM"

    def test_cannot_message_self(self, auth_headers):
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        username = me.json()["username"]
        res = requests.post(
            f"{BASE_URL}/api/dms/{username}/send",
            json={"content": "message to self"},
            headers=auth_headers
        )
        assert res.status_code == 400

    def test_dm_unread_count(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/dms/unread-count", headers=auth_headers)
        assert res.status_code == 200
        assert "count" in res.json()


class TestNotifications:
    """Notification endpoints"""

    def test_get_notifications(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_unread_count(self, auth_headers):
        res = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=auth_headers)
        assert res.status_code == 200
        assert "count" in res.json()
        assert isinstance(res.json()["count"], int)

    def test_mark_read(self, auth_headers):
        res = requests.put(f"{BASE_URL}/api/notifications/read", headers=auth_headers)
        assert res.status_code == 200

    def test_mention_creates_notification(self, auth_headers, auth_headers2):
        me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers2)
        username2 = me2.json()["username"]

        res = requests.post(
            f"{BASE_URL}/api/posts",
            json={"content": f"TEST_mention @{username2} post"},
            headers=auth_headers
        )
        assert res.status_code == 200
        post_id = res.json()["id"]

        # Check notifications for user2
        notifs = requests.get(f"{BASE_URL}/api/notifications", headers=auth_headers2)
        assert notifs.status_code == 200
        mention_notifs = [n for n in notifs.json() if n["type"] == "mention"]
        assert len(mention_notifs) > 0

        requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=auth_headers)
