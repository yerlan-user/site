# Новости аэропорта Астаны на sakenov.kz

Страница `sakenov.kz/airport/` показывает посты (текст и фото) из Instagram
международного аэропорта Нурсултан Назарбаев. Всё бесплатно:

- **GitHub Actions** (`.github/workflows/airport-news.yml`) раз в час запускает
  `scripts/fetch_airport_news.py`;
- скрипт берёт посты через официальный **Instagram Graph API (Business Discovery)**,
  скачивает фото в `airport/media/` и пишет текст в `airport/posts.json`;
- **GitHub Pages** публикует обновлённую страницу.

Читателям сайта и скрипту логин в Instagram не нужен. Один раз нужно получить
доступ к API — от имени **вашего** профессионального аккаунта Instagram.

## Настройка (один раз, ~20 минут)

1. **Профессиональный аккаунт.** В приложении Instagram: Настройки → Тип аккаунта →
   переключиться на «Профессиональный» (например, @yerlansakenov). Привяжите его
   к странице Facebook.
2. **Приложение Meta.** На [developers.facebook.com](https://developers.facebook.com/apps)
   создайте приложение типа «Business» и добавьте продукт «Instagram Graph API».
3. **Токен.** В [Graph API Explorer](https://developers.facebook.com/tools/explorer)
   выберите приложение, разрешения `instagram_basic`, `pages_show_list`,
   `business_management` и нажмите «Generate Access Token».
   Для работы без продления лучше сделать бессрочный токен системного пользователя:
   business.facebook.com → Настройки компании → Пользователи → Системные пользователи.
   Обычный токен из Explorer действует 1–2 часа, долгосрочный — 60 дней.
4. **ID вашего Instagram.** В Graph API Explorer выполните
   `me/accounts?fields=instagram_business_account` — нужен `instagram_business_account.id`.
5. **Секреты в GitHub.** Репозиторий → Settings → Secrets and variables → Actions:
   - *Secrets*: `IG_USER_ID` (ID из шага 4) и `IG_ACCESS_TOKEN` (токен из шага 3);
   - *Variables*: `IG_TARGET` — имя аккаунта аэропорта без `@`
     (или впишите его в `airport/config.json`).
6. **Первый запуск.** Вкладка Actions → «Новости аэропорта из Instagram» → Run workflow.
   Через минуту лента появится на sakenov.kz/airport/.

## Ограничения

- Business Discovery читает только бизнес- и авторские аккаунты (у официальных
  аккаунтов компаний это так).
- Для видео сохраняется обложка; сам ролик открывается по ссылке «В Instagram».
- На сайте хранятся последние 60 постов, фото старых постов удаляются автоматически.
- Если ошибка в Actions говорит о просроченном токене — выпустите новый и обновите
  секрет `IG_ACCESS_TOKEN`.
