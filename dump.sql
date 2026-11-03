--
-- PostgreSQL database dump
--

\restrict qI4JOkIXzrNnfzVKdLISXNuKhmU9kNmrSz3uGIctKcWVrHJTOlIL2mUylWBvyfx

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: -
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	cf8f7eb9bfcead29b618b0ee26d2fb761f72e526f07fc62b1083c2dcff5b7b0e	1793546160503
2	b2ba978a3fab996ba23711262f1c820802e0753fd5aa33bdda1f595c5d80c386	1793738145607
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."user" (id, name, email, email_verified, image, created_at, updated_at) FROM stdin;
fE1ovo2y0oLhETOOTh0czZeyOK7abcdp	test	test@test.com	f	\N	2026-11-03 21:27:40.884	2026-11-03 21:27:40.884
\.


--
-- Data for Name: workspace; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workspace (id, name, description, "creatorId", "clerkOrgId", status, "position", "shareToken", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AgentPrompt; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AgentPrompt" (id, "ownerId", "userId", "workspaceId", "createdAt") FROM stdin;
\.


--
-- Data for Name: account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at) FROM stdin;
Zf2F7jR5mDBao9g4k0jU0w00OXHHLsDP	fE1ovo2y0oLhETOOTh0czZeyOK7abcdp	credential	fE1ovo2y0oLhETOOTh0czZeyOK7abcdp	\N	\N	\N	\N	\N	\N	aca73ac4cf9814f5caa0ed5f2da99e2b:e8263ccc67fcf427dd19ab4ddcf46b70ac7a9a002f74ae15f82ad27dc9355906ab449dfdae523ee8b2659d0c566823697c20b749a61159f069bc7b6389cc255d	2026-11-03 21:27:40.892	2026-11-03 21:27:40.892
\.


--
-- Data for Name: canvas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.canvas (id, "workspaceId", content, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: doc; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.doc (id, "workspaceId", content, "yjsState", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id) FROM stdin;
4C3AkDUyztVyCvi5tX75pdCOCfvvBoG8	2026-11-10 21:27:40.898	xsbxbQbIlUfR1uPwYcGuT1obd1jocApW	2026-11-03 21:27:40.899	2026-11-03 21:27:40.899	0000:0000:0000:0000:0000:0000:0000:0000	Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36	fE1ovo2y0oLhETOOTh0czZeyOK7abcdp
\.


--
-- Data for Name: verification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification (id, identifier, value, expires_at, created_at, updated_at) FROM stdin;
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: -
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--

\unrestrict qI4JOkIXzrNnfzVKdLISXNuKhmU9kNmrSz3uGIctKcWVrHJTOlIL2mUylWBvyfx

