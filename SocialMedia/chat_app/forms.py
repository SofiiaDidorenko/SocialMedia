from django import forms
from chat_app.models import Chat
from django.contrib.auth import get_user_model

User = get_user_model()

class MessageForm(forms.Form):
    message = forms.CharField(max_length=255, label='Ваше повідомлення')


# ДОДАНІ ФОРМИ ДЛЯ СТВОРЕННЯ ГРУПОВИХ ЧАТІВ
class GroupSelectUsersForm(forms.Form):
    """Форма першого кроку: вибір учасників чату серед друзів"""
    users = forms.ModelMultipleChoiceField(
        queryset=User.objects.none(),
        widget=forms.CheckboxSelectMultiple(attrs={'class': 'group-user-checkbox'}),
        required=True
    )

    def __init__(self, user, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from user_app.utils.friend_queries import get_user_by_section
        # Динамічно завантажуємо тільки друзів користувача, який викликав форму
        self.fields['users'].queryset = get_user_by_section(user, 'friends')


class GroupDetailsForm(forms.ModelForm):
    """Форма другого кроку: введення назви та завантаження аватарки групи"""
    class Meta:
        model = Chat
        fields = ['name', 'avatar']
        widgets = {
            'name': forms.TextInput(attrs={
                'class': 'input-field',
                'placeholder': 'Введіть назву',
                'maxlength': 30
            }),
            'avatar': forms.FileInput(attrs={
                'class': 'hidden-file-input',
                'id': 'group-avatar-upload',
                'accept': 'image/*'
            })
        }
