# Root & Reason

## Mission Statement
Our mission is to help people care for themselves at home using remedies rooted in their culture and around the world. Root and Remedy provides additional methods of self care that will support your health in daily life activities - pairing traditional practices with science-based information, clear safety guidance, and respect for privacy. We prioritize centering culture and keeping our users up to date with safe-remedial care.
## Team
- Ahshah Olivia Kennedy - Project Manager
- Akeara Serrano - Product Designer
- Saket Marina - Developer
- Tiange Zhao - Developer
- Ash Siwakoti - Developer

## Team Performance Matrix
Skills and competencies the class uses to measure performance.

| Everyone | Developer | Designer | PM |
| --- | --- | --- | --- |
| Active communication during problems | Clean code | Creativity | Planning clear milestones |
| Staying on time | Maintaining the same style of code throughout the project process | Open to feedback | Tracking progress for all members |
| | Technical design (efficient code) | Utilize human centered design | Planning meeting times |

## Documentation
- [Competitive Analysis](Competitive%20Analysis%20Template%20-%20Team%20E.pdf)

- Link to notion workspace: https://app.notion.com/p/Root-n-Remedy-3f7cfaf13eac802a87eedb28d471e061?source=copy_link
- [Design and Specifications](https://app.notion.com/p/Design-and-Specifications-3fecfaf13eac809e8152fd4b365d0f63)
- [Design Notes](https://app.notion.com/p/Design-Specification-Assignment-3f8cfaf13eac80ad85d2f90c50ce1211)
- [Testing Plan](https://app.notion.com/p/Testing-Plan-414cfaf13eac8099b85ce758bd4d751c?source=copy_link))
- Live site: https://root-and-reason-eight.vercel.app/
- Milestones: https://github.com/saket-marina/root-and-reason/milestones

## Local app

This repository contains the initial React application for Root & Remedy.

```sh
npm install
npm run dev
```

The first-visit learning-only notice is saved in browser local storage after the visitor checks the acknowledgement and accepts.

## Remedy data

Use Node 22.12 or newer and Java 21 or newer. Run `npm ci`, then start the local emulator with `npm run firestore:start`. In a second terminal, run `npm run firestore:seed` and `npm run dev:firestore`. Open [Remedies](http://127.0.0.1:5176/remedies) to browse the 20 records. The standard `npm run dev` and production build use the bundled JSON.

[Data](data/remedy-samples.json) contains 20 remedies, 14 health goals, 14 extracted primary studies, 20 origin records, and 76 sources. Claims carry source IDs and section locators. Photos are supplied unchanged, with credits and license links in each record. The existing filename and three sample IDs are preserved for compatibility.
Remedy description: [to be filled in]
Origin labels are Africa, Asia, Europe, and North America. Cranberry replaces tea tree to keep this scope. Four records have no established geographic origin and explain that omission. Preparation times and four analyzed participant counts remain unknown. Safety scores stay null, and medical review is pending.

Run `npm run data:check` to check record links, citations, counts, and photo files before seeding. Research counts cover the extracted primary records. Reviews remain cited separately and their totals are excluded from the comparison charts.

## Quality

### Accessibility

- Pages use headings, landmarks, labeled search fields, descriptive image text, and status or alert messages for results and errors.
- The origin map works with a keyboard: country regions can be reached with Tab and selected with Enter or Space. A region list is also available as an alternative to the map. Remedy detail tabs support arrow-key navigation, and interactive controls have visible focus styles.
- We checked seven routes with Lighthouse Accessibility on desktop and mobile; each scored 100.

### Security

- The app does not require an account. Saved remedies, comparisons, and the learning-only acknowledgement stay in browser local storage on the current device; saved items do not sync to an account or another device.
- The standard app and production build use bundled sample data. Local Firestore development uses rules that allow reads only from the remedy sample collections and do not allow writes.
- External links opened in a new tab use `rel="noreferrer"` or `rel="noopener noreferrer"`. Browser storage reads are guarded against invalid data and storage errors.

### Responsivity

- Layouts adjust at mobile breakpoints: navigation wraps, page spacing tightens, cards and detail sections stack, and comparison charts switch to a single-column layout on narrow screens.
- The origin map sits in a labeled horizontal scroll area on small screens, so the country shapes remain usable without shrinking the map to an unreadable size.
- Headings and map text use fluid sizing, and content widths are capped to keep pages readable on wide screens.
