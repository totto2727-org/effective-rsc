# Upstream baseline

This document records the immutable upstream starting point for future comparisons and selective updates.
It is distinct from the version of this Workers fork.

| Field                                     | Recorded baseline                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Upstream repository                       | <https://github.com/nikhilsnayak/effective-rsc>                           |
| Upstream package                          | `effective-rsc`                                                           |
| Package manifest version at the baseline  | `0.1.4`                                                                   |
| Baseline commit                           | `ed886996d1d3780b94166af4f798c53416d547c8`                                |
| Commit timestamp                          | `2026-09-10T07:08:42Z`                                                    |
| Commit subject                            | `Merge pull request #30 from nikhilsnayak/chore/update-package-homepages` |
| Last fully incorporated upstream baseline | `ed886996d1d3780b94166af4f798c53416d547c8`                                |

Sources: [upstream commit](https://github.com/nikhilsnayak/effective-rsc/commit/ed886996d1d3780b94166af4f798c53416d547c8) and [package manifest at that commit](https://github.com/nikhilsnayak/effective-rsc/blob/ed886996d1d3780b94166af4f798c53416d547c8/packages/effective-rsc/package.json).
The version above is read from the manifest, not an assertion that the commit is a release tag or an exact npm publication.
The parent of this fork's first local implementation commit, `d391de2`, is the recorded baseline, and the upstream history remains in this repository.

## Future incorporation

Keep the original baseline immutable.
When upstream changes are incorporated, record the source commits, corresponding local commits, scope, and validation below.
Advance the last fully incorporated baseline only when the complete change range has been accounted for; a selective cherry-pick does not imply all intervening upstream changes were incorporated.
The Workers/VitePlus runtime intentionally replaces upstream Bun/Rspack behavior, so upstream changes need compatibility review rather than unconditional merging.

| Recorded on | Upstream commit or range                   | Local commit                  | Scope and validation                                                             |
| ----------- | ------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------- |
| 2026-09-12  | `ed886996d1d3780b94166af4f798c53416d547c8` | Baseline before local changes | Confirmed using the historical package manifest and first local commit's parent. |
