--
-- PostgreSQL database dump
--

\restrict erLZ5v9pRkIU69ttXJr8guN1GKNfPdwSxsABGzYrn2IX8qP4L5rsJg3KOQpgRsd

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg13+2)

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
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: lifetrace
--

INSERT INTO public.assets VALUES (1, 'D001', 'DRONE', 'Research Drone Alpha', 'ACTIVE', '2026-01-01', '2026-01-01 00:00:00+00');
INSERT INTO public.assets VALUES (2, 'D009', 'DRONE', 'Research Drone Beta', 'ACTIVE', '2026-01-01', '2026-01-01 00:00:00+00');
INSERT INTO public.assets VALUES (3, 'D014', 'ROBOT', 'Mobile Robot Gamma', 'ACTIVE', '2026-01-01', '2026-01-01 00:00:00+00');


--
-- Data for Name: asset_slots; Type: TABLE DATA; Schema: public; Owner: lifetrace
--

INSERT INTO public.asset_slots VALUES (1, 1, 'battery-main', 'BATTERY', '2026-01-01 00:00:00+00');
INSERT INTO public.asset_slots VALUES (2, 1, 'camera-front', 'CAMERA', '2026-01-01 00:00:00+00');
INSERT INTO public.asset_slots VALUES (3, 1, 'motor-left', 'MOTOR', '2026-01-01 00:00:00+00');
INSERT INTO public.asset_slots VALUES (4, 1, 'motor-right', 'MOTOR', '2026-01-01 00:00:00+00');
INSERT INTO public.asset_slots VALUES (5, 2, 'battery-main', 'BATTERY', '2026-01-01 00:00:00+00');
INSERT INTO public.asset_slots VALUES (6, 3, 'battery-main', 'BATTERY', '2026-01-01 00:00:00+00');


--
-- Data for Name: component_models; Type: TABLE DATA; Schema: public; Owner: lifetrace
--

INSERT INTO public.component_models VALUES (1, 'BATTERY', 'PowerCell', 'PX-80', '80 Wh 实验平台电池');
INSERT INTO public.component_models VALUES (2, 'CAMERA', 'OpticLab', 'Vision C4', '前置视觉模组');
INSERT INTO public.component_models VALUES (3, 'MOTOR', 'MotionWorks', 'M-30', '无刷电机');


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: lifetrace
--

INSERT INTO public.users VALUES (1, '张晓 · Alice', 'TECHNICIAN', '2026-09-22 11:09:20.350949+00');
INSERT INTO public.users VALUES (2, '李明 · Manager', 'MANAGER', '2026-09-22 11:09:20.351363+00');


--
-- Data for Name: component_batches; Type: TABLE DATA; Schema: public; Owner: lifetrace
--

INSERT INTO public.component_batches VALUES (1, 1, 'BAT-2026-03', '2026-02-01', 'NORMAL', NULL, NULL, NULL);
INSERT INTO public.component_batches VALUES (2, 1, 'BAT-2026-06', '2026-02-01', 'NORMAL', NULL, NULL, NULL);
INSERT INTO public.component_batches VALUES (3, 2, 'CAM-2026-01', '2026-01-01', 'NORMAL', NULL, NULL, NULL);
INSERT INTO public.component_batches VALUES (4, 3, 'MOT-2026-01', '2026-01-01', 'NORMAL', NULL, NULL, NULL);


--
-- Data for Name: components; Type: TABLE DATA; Schema: public; Owner: lifetrace
--

INSERT INTO public.components VALUES (1, 'B102', 1, 'GOOD', '2026-02-15 00:00:00+00');
INSERT INTO public.components VALUES (2, 'B118', 1, 'GOOD', '2026-02-15 00:00:00+00');
INSERT INTO public.components VALUES (3, 'B221', 2, 'GOOD', '2026-02-15 00:00:00+00');
INSERT INTO public.components VALUES (4, 'B300', 2, 'GOOD', '2026-02-15 00:00:00+00');
INSERT INTO public.components VALUES (5, 'C004', 3, 'GOOD', '2026-02-15 00:00:00+00');
INSERT INTO public.components VALUES (6, 'M031', 4, 'GOOD', '2026-02-15 00:00:00+00');
INSERT INTO public.components VALUES (7, 'M033', 4, 'GOOD', '2026-02-15 00:00:00+00');
INSERT INTO public.components VALUES (8, 'B500', 2, 'DEFECTIVE', '2026-02-15 00:00:00+00');


--
-- Data for Name: maintenance_events; Type: TABLE DATA; Schema: public; Owner: lifetrace
--

INSERT INTO public.maintenance_events VALUES (1, 1, 1, 'INSTALL', '2026-03-01 00:00:00+00', '初始装配');
INSERT INTO public.maintenance_events VALUES (2, 3, 1, 'INSTALL', '2026-03-01 00:00:00+00', '初始装配');
INSERT INTO public.maintenance_events VALUES (3, 1, 1, 'INSTALL', '2026-03-01 00:00:00+00', '初始装配');
INSERT INTO public.maintenance_events VALUES (4, 1, 1, 'INSTALL', '2026-03-01 00:00:00+00', '初始装配');
INSERT INTO public.maintenance_events VALUES (5, 1, 1, 'INSTALL', '2026-03-01 00:00:00+00', '初始装配');


--
-- Data for Name: installations; Type: TABLE DATA; Schema: public; Owner: lifetrace
--

INSERT INTO public.installations VALUES (1, 1, 1, '2026-03-01 00:00:00+00', NULL, 1, NULL);
INSERT INTO public.installations VALUES (2, 6, 2, '2026-03-01 00:00:00+00', NULL, 2, NULL);
INSERT INTO public.installations VALUES (3, 2, 5, '2026-03-01 00:00:00+00', NULL, 3, NULL);
INSERT INTO public.installations VALUES (4, 3, 6, '2026-03-01 00:00:00+00', NULL, 4, NULL);
INSERT INTO public.installations VALUES (5, 4, 7, '2026-03-01 00:00:00+00', NULL, 5, NULL);


--
-- Name: asset_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lifetrace
--

SELECT pg_catalog.setval('public.asset_slots_id_seq', 6, true);


--
-- Name: assets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lifetrace
--

SELECT pg_catalog.setval('public.assets_id_seq', 3, true);


--
-- Name: component_batches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lifetrace
--

SELECT pg_catalog.setval('public.component_batches_id_seq', 4, true);


--
-- Name: component_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lifetrace
--

SELECT pg_catalog.setval('public.component_models_id_seq', 3, true);


--
-- Name: components_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lifetrace
--

SELECT pg_catalog.setval('public.components_id_seq', 8, true);


--
-- Name: installations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lifetrace
--

SELECT pg_catalog.setval('public.installations_id_seq', 5, true);


--
-- Name: maintenance_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lifetrace
--

SELECT pg_catalog.setval('public.maintenance_events_id_seq', 5, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lifetrace
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- PostgreSQL database dump complete
--

\unrestrict erLZ5v9pRkIU69ttXJr8guN1GKNfPdwSxsABGzYrn2IX8qP4L5rsJg3KOQpgRsd
