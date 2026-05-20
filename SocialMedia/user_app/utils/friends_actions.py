from user_app.models import Friendship

def friend_request(user, other_user):
    Friendship.objects.get_or_create(from_user= user, to_user= other_user, defaults= {"status": "pending"})
    return {"label": "Очікування"}

def friend_reject(user, other_user):
    Friendship.objects.get_or_create(from_user= user, to_user= other_user, defaults= {"status": "dismissed"})
    return {"remove": True}

def friend_accept(user, other_user):
    friendship = Friendship.objects.filter(from_user= user, to_user= other_user).first()
    friendship.status = "accepted"
    friendship.save()
    return {"remove": True, "friend": True}


def friend_delete(user, other_user):
    friendship = Friendship.objects.filter(from_user= user, to_user= other_user).first()
    if not friendship:
        friendship = Friendship.objects.filter(from_user= other_user, to_user= user).first()
    if friendship:
        friendship.delete()
    return {"remove": True}