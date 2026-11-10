# ToKpokki Go — меню и заказ со стола

Страница: https://sakenov.kz/tokpokki/ (`?table=7` подставляет номер стола).

- `menu.js` — меню и цены, правятся вручную.
- `config.js` — WhatsApp кассы и ссылка оплаты Kaspi (`kaspiUrl`).
- `qr/qr.svg|png` — красивый QR, `qr/poster.pdf|png` — плакат A5 для стола.
- `qr/make_qr.py <url> <out.svg>` — перегенерировать QR (нужен `pip install segno`).
