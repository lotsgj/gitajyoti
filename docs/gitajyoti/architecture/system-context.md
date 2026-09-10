# System context

```text
Gita Jyoti site
├── Landing region
└── MyGita region
    ├── identity and profile
    ├── discovery and enrolment
    ├── journey orchestration
    └── aggregated progress

Learning products
├── Gita for Children     → gita4children.app
├── Gita Sāra             → gitasara.app
├── Pūrṇa Yoga Darśana    → future application
└── Gita Yoga             → future application
```

The Landing and MyGita regions belong to the Gita Jyoti site. Learning products are first-class applications connected to MyGita through explicit product-specific APIs.

In the target architecture, the browser communicates with `mygita.api`. Server-side MyGita integrations communicate with product APIs and issue short-lived launch results when a learner enters a product. The current browser remains fixture-backed and is not connected to this API path.
