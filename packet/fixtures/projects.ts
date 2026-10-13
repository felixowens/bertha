// Generated fixture — invented data with realistic shape.
import type { Project, ProjectSetup } from "../contract/domain"

export const projects: Project[] = [
  {
    "client": "Kiln & Clay Ceramics Ltd",
    "url": "https://kilnandclay.co.uk",
    "environments": [
      "production",
      "staging"
    ],
    "monitorId": "mon-kiln",
    "id": "p-kiln",
    "key": "KILN",
    "name": "Kiln & Clay",
    "runtimes": [
      "browser",
      "server"
    ],
    "health": "new_issues",
    "unresolvedIssues": 29,
    "events24h": 1514,
    "lastEventAt": "2026-10-13T09:11:20Z"
  },
  {
    "client": "Harbour Dental Group",
    "url": "https://book.harbourdental.co.uk",
    "environments": [
      "production",
      "staging"
    ],
    "monitorId": "mon-harbour",
    "id": "p-harbour",
    "key": "HARB",
    "name": "Harbour Dental bookings",
    "runtimes": [
      "browser",
      "server",
      "edge"
    ],
    "health": "down",
    "unresolvedIssues": 15,
    "events24h": 707,
    "lastEventAt": "2026-10-13T09:11:35Z"
  },
  {
    "client": "Mossgrove Hall",
    "url": "https://enquiries.mossgrovehall.co.uk",
    "environments": [
      "production"
    ],
    "monitorId": "mon-moss",
    "id": "p-moss",
    "key": "MOSS",
    "name": "Mossgrove Hall Weddings & Events — Enquiries, Availability and Booking Portal",
    "runtimes": [
      "browser",
      "server"
    ],
    "health": "regressed",
    "unresolvedIssues": 14,
    "events24h": 30,
    "lastEventAt": "2026-10-13T08:22:00Z"
  },
  {
    "client": null,
    "url": "https://tides.sundial.dev",
    "environments": [
      "production"
    ],
    "monitorId": "mon-tides",
    "id": "p-tides",
    "key": "TIDE",
    "name": "tide-times-api",
    "runtimes": [
      "server"
    ],
    "health": "healthy",
    "unresolvedIssues": 3,
    "events24h": 8,
    "lastEventAt": "2026-10-13T06:09:00Z"
  },
  {
    "client": null,
    "url": "https://plot.sundial.dev",
    "environments": [
      "production",
      "development"
    ],
    "monitorId": "mon-allot",
    "id": "p-allot",
    "key": "ALOT",
    "name": "Allotment Planner",
    "runtimes": [
      "browser",
      "server"
    ],
    "health": "new_issues",
    "unresolvedIssues": 10,
    "events24h": 7,
    "lastEventAt": "2026-10-13T07:48:00Z"
  },
  {
    "client": "St Aidan's Church, Whitby",
    "url": "https://staidans-whitby.org.uk",
    "environments": [
      "production"
    ],
    "monitorId": "mon-parish",
    "id": "p-parish",
    "key": "AIDN",
    "name": "St Aidan's newsletter",
    "runtimes": [
      "browser"
    ],
    "health": "healthy",
    "unresolvedIssues": 5,
    "events24h": 2,
    "lastEventAt": "2026-10-13T03:39:00Z"
  },
  {
    "client": null,
    "url": "https://fieldnotes.sundial.dev",
    "environments": [
      "production"
    ],
    "monitorId": "mon-field",
    "id": "p-field",
    "key": "FLDN",
    "name": "fieldnotes",
    "runtimes": [
      "browser"
    ],
    "health": "healthy",
    "unresolvedIssues": 4,
    "events24h": 1,
    "lastEventAt": "2026-10-10T19:05:00Z"
  },
  {
    "client": null,
    "url": null,
    "environments": [
      "production"
    ],
    "monitorId": null,
    "id": "p-invoice",
    "key": "INVC",
    "name": "Invoice runner",
    "runtimes": [
      "server"
    ],
    "health": "healthy",
    "unresolvedIssues": 0,
    "events24h": 0,
    "lastEventAt": "2026-10-10T15:36:00Z"
  },
  {
    "client": null,
    "url": "https://sundial.dev",
    "environments": [
      "production"
    ],
    "monitorId": "mon-portfolio",
    "id": "p-portfolio",
    "key": "SUND",
    "name": "sundial.dev",
    "runtimes": [
      "browser"
    ],
    "health": "healthy",
    "unresolvedIssues": 0,
    "events24h": 0,
    "lastEventAt": null
  },
  {
    "client": null,
    "url": null,
    "environments": [
      "production"
    ],
    "monitorId": null,
    "id": "p-recipes",
    "key": "RCPE",
    "name": "Recipe box",
    "runtimes": [
      "browser",
      "server"
    ],
    "health": "awaiting_first_event",
    "unresolvedIssues": 0,
    "events24h": 0,
    "lastEventAt": null
  }
]

export const projectSetups: ProjectSetup[] = [
  {
    "projectId": "p-kiln",
    "ingestKey": "7711956ee7f8d6da7eaf0c97d0ea2a1d",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://7711956ee7f8d6da7eaf0c97d0ea2a1d@ingest.bertha.dev/kiln\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project kiln --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": "2026-08-03T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "2026.10.12-1",
      "uploaded": true
    }
  },
  {
    "projectId": "p-harbour",
    "ingestKey": "40411c8169061d4812c7783a0ce36ea8",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://40411c8169061d4812c7783a0ce36ea8@ingest.bertha.dev/harb\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project harb --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": "2025-11-29T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "v2.14.0",
      "uploaded": true
    }
  },
  {
    "projectId": "p-moss",
    "ingestKey": "730966a5732705f7fd6bf1994536ae58",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://730966a5732705f7fd6bf1994536ae58@ingest.bertha.dev/moss\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project moss --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": "2026-06-26T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "v3.8.1",
      "uploaded": false
    }
  },
  {
    "projectId": "p-tides",
    "ingestKey": "59c00ae7029bcf957a4e0dce4ac6b439",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://59c00ae7029bcf957a4e0dce4ac6b439@ingest.bertha.dev/tide\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project tide --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": "2025-10-07T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "ca4fda5",
      "uploaded": true
    }
  },
  {
    "projectId": "p-allot",
    "ingestKey": "07f2ba29e0e8eafcf4893f269c7954c0",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://07f2ba29e0e8eafcf4893f269c7954c0@ingest.bertha.dev/alot\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project alot --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": "2025-10-16T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "27a7795",
      "uploaded": true
    }
  },
  {
    "projectId": "p-parish",
    "ingestKey": "d113dd8d4bda17ad9b3f2934581fad07",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://d113dd8d4bda17ad9b3f2934581fad07@ingest.bertha.dev/aidn\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project aidn --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": "2026-04-24T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "1.4.0",
      "uploaded": true
    }
  },
  {
    "projectId": "p-field",
    "ingestKey": "39ca4385e19803522a6d4cf527ca4f0b",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://39ca4385e19803522a6d4cf527ca4f0b@ingest.bertha.dev/fldn\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project fldn --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": "2026-02-16T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "8cddf58",
      "uploaded": true
    }
  },
  {
    "projectId": "p-invoice",
    "ingestKey": "11da5e7701e85db53c19c986c60df8f9",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://11da5e7701e85db53c19c986c60df8f9@ingest.bertha.dev/invc\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project invc --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": "2025-11-29T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "0.9.0",
      "uploaded": true
    }
  },
  {
    "projectId": "p-portfolio",
    "ingestKey": "5d748a394c293a30a041c3804e7c548f",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://5d748a394c293a30a041c3804e7c548f@ingest.bertha.dev/sund\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project sund --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": "2026-07-02T09:12:00Z",
    "sourceMaps": {
      "latestRelease": "37728ef",
      "uploaded": true
    }
  },
  {
    "projectId": "p-recipes",
    "ingestKey": "767cefad9628071235852c19b2c6949e",
    "snippet": "# 1. Point your app's error client at this project\nERROR_REPORTING_DSN=\"https://767cefad9628071235852c19b2c6949e@ingest.bertha.dev/rcpe\"\n\n# 2. Tag each deploy and upload source maps (in your build step)\nnpx bertha-cli release --project rcpe --version \"$COMMIT_SHA\" --sourcemaps ./build",
    "firstEventAt": null,
    "sourceMaps": {
      "latestRelease": null,
      "uploaded": false
    }
  }
]
