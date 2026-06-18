/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum OncologyCategory {
  // Head & Neck
  ORAL_CAVITY = "Oral cavity",
  OROPHARYNX = "Oropharynx",
  NASOPHARYNX = "Nasopharynx",
  HYPOPHARYNX = "Hypopharynx",
  LARYNX = "Larynx",
  LIP = "Lip",
  TONGUE = "Tongue",
  PAROTID = "Parotid",
  SUBMANDIBULAR = "Submandibular",
  SALIVARY_GLAND = "Salivary gland (other)",
  MANDIBULAR = "Mandibular",
  MAXILLARY_SINUS = "Maxillary sinus",
  NASAL_CAVITY = "Nasal cavity / Paranasal sinuses",
  THYROID = "Thyroid",
  EYE_ORBITAL = "Eye / Orbital",
  OCULAR_MELANOMA = "Ocular melanoma",
  RETINOBLASTOMA = "Retinoblastoma",
  LACRIMAL_GLAND = "Lacrimal gland",
  EAR_TEMPORAL = "Ear / Temporal bone",

  // Thoracic / Respiratory
  LUNG = "Lung",
  MESOTHELIOMA = "Mesothelioma",
  THYMUS = "Thymus / Thymoma",
  CHEST_WALL = "Chest wall",

  // Breast
  BREAST = "Breast",
  MALE_BREAST = "Male breast cancer",

  // Gastrointestinal
  ESOPHAGUS = "Esophagus",
  GASTRIC = "Gastric / Stomach",
  SMALL_BOWEL = "Small bowel",
  LARGE_BOWEL = "Large bowel / Colon",
  RECTAL = "Rectal",
  ANAL_CANAL = "Anal canal",
  APPENDIX = "Appendix",
  LIVER = "Liver / Hepatocellular",
  GALL_BLADDER = "Gall bladder",
  BILIARY_TREE = "Biliary tree / Cholangiocarcinoma",
  PANCREAS = "Pancreas",
  GIST = "GIST",
  GI_NEUROENDOCRINE = "GI Neuroendocrine tumor",

  // Genitourinary
  RENAL = "Renal / Kidney",
  BLADDER = "Bladder",
  PROSTATE = "Prostate",
  PENIS = "Penis",
  TESTICULAR = "Testicular",
  URETHRA = "Urethra",
  URETER = "Ureter",

  // Gynecologic
  OVARY = "Ovary",
  UTERUS_CERVIX = "Uterus / Cervix",
  ENDOMETRIAL = "Endometrial",
  FALLOPIAN_TUBES = "Fallopian tubes",
  VAGINAL = "Vaginal",
  VULVAR = "Vulvar",
  GESTATIONAL_TROPHOBLASTIC = "Gestational trophoblastic disease",

  // Musculoskeletal / Sarcoma
  BONE_OSTEOSARCOMA = "Bone / Osteosarcoma",
  CHONDROSARCOMA = "Chondrosarcoma",
  EWING_SARCOMA = "Ewing sarcoma",
  SOFT_TISSUE_SARCOMA = "Soft tissue sarcoma",
  LEIOMYOSARCOMA = "Leiomyosarcoma",
  LIPOSARCOMA = "Liposarcoma",
  RHABDOMYOSARCOMA = "Rhabdomyosarcoma",
  SYNOVIAL_SARCOMA = "Synovial sarcoma",
  KAPOSI_SARCOMA = "Kaposi sarcoma",
  DFSP = "Dermatofibrosarcoma protuberans",

  // Skin
  SKIN_MELANOMA = "Skin / Melanoma",
  SKIN_SQUAMOUS = "Skin / Squamous cell",
  SKIN_BASAL = "Skin / Basal cell",
  MERKEL_CELL = "Merkel cell carcinoma",

  // Hematologic / Lymphoid
  LEUKEMIA_AML = "Leukemia / AML",
  LEUKEMIA_ALL = "Leukemia / ALL",
  LEUKEMIA_CLL = "Leukemia / CLL",
  LEUKEMIA_CML = "Leukemia / CML",
  LYMPHOMA_HODGKIN = "Lymphoma / Hodgkin",
  LYMPHOMA_NON_HODGKIN = "Lymphoma / Non-Hodgkin",
  MULTIPLE_MYELOMA = "Multiple myeloma / Plasma cell",
  MDS = "Myelodysplastic syndrome (MDS)",
  MPN = "Myeloproliferative neoplasm (MPN)",
  WALDENSTROM = "Waldenström macroglobulinemia",

  // Central Nervous System
  BRAIN_GLIOMA = "Brain / Glioma",
  GLIOBLASTOMA = "Glioblastoma",
  MENINGIOMA = "Meningioma",
  MEDULLOBLASTOMA = "Medulloblastoma",
  PITUITARY = "Pituitary / Sellar",
  SPINAL_CORD = "Spinal cord tumors",
  PRIMARY_CNS_LYMPHOMA = "Primary CNS lymphoma",
  NEUROBLASTOMA = "Neuroblastoma",

  // Endocrine
  ADRENALS = "Adrenals",
  ADRENAL_CORTICAL = "Adrenal cortical carcinoma",
  PHEOCHROMOCYTOMA = "Pheochromocytoma",
  PARATHYROID = "Parathyroid",
  CARCINOID = "Carcinoid / Neuroendocrine (general)",
  MEN = "Multiple endocrine neoplasia",

  // Pediatric / Embryonal
  WILMS_TUMOR = "Wilms tumor / Nephroblastoma",
  HEPATOBLASTOMA = "Hepatoblastoma",
  LCH = "Langerhans cell histiocytosis",
  GERM_CELL = "Germ cell tumors",

  // Other
  SPLEEN = "Spleen",
  HEART = "Heart",
  PERITONEAL = "Peritoneal",
  RETROPERITONEAL = "Retroperitoneal",
  CUP = "Cancer of unknown primary (CUP)",
  OTHER = "Other"
}

export type PatientStatus = "active" | "under_treatment" | "follow_up" | "discharged";

export interface DrugTableEntry {
  drug_name: string;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  notes: string;
}

export interface FamilyTableEntry {
  comorbidity: string;
  relationship: string;
  family_notes: string;
}

export interface RiskTableEntry {
  risk_factor: string;
  risk_notes: string;
}

export interface PresentingComplaintEntry {
  date: string;
  complaint: string;
  notes: string;
}

export interface PastMedicalEntry {
  date: string;
  comorbidity: string;
  notes: string;
}

export interface PriorTreatmentEntry {
  date: string;
  agent: string;
  dose: string;
  frequency: string;
  duration: string;
  cancer_type: string;
  adverse_effects: string;
  notes: string;
}

export interface PastSurgicalEntry {
  date: string;
  surgery: string;
  complication: string;
  notes: string;
}

export interface DefinitiveDiagnosisEntry {
  date: string;
  diagnosis: string;
  notes: string;
}

export interface ExamFindingsEntry {
  organ_system: string;
  findings: string;
  notes: string;
}

export interface ExamFindingsGroup {
  date: string;
  entries: ExamFindingsEntry[];
}

export interface SystemicInquiryEntry {
  system: string;
  symptoms: string[];
}

export interface AnthropometricEntry {
  date: string;
  height: string;
  weight: string;
  bmi: string;
  bsa: string;
}

export interface OtherAnthropometricEntry {
  measure: string;
  value: string;
  unit: string;
}

export interface OtherAnthropometricGroup {
  date: string;
  entries: OtherAnthropometricEntry[];
}

export interface GeneticTestEntry {
  test_name: string;
  gene: string;
  variant: string;
  result: string;
  method: string;
  date: string;
  purpose: string; // "Diagnosis" | "Confirmation" | "Risk Assessment" | "Therapy Selection" | "Prognosis" | "Screening"
  notes: string;
}

export interface ContrastStudyEntry {
  study_type: string;
  contrast_agent: string;
  body_part: string;
  findings: string;
  date: string;
  purpose: string; // "Diagnosis" | "Staging" | "Follow up" | "Treatment Planning" | "Assessment"
  notes: string;
}

export interface BloodTableEntry {
  blood_type: string;
  blood_purpose: string; // "Diagnosis" | "confirmation" | "prognosis" | "follow up"
  blood_date: string;
  blood_findings: string;
  blood_notes: string;
}

export interface TumorMarkerTableEntry {
  marker_name: string;
  marker_value: string;
  marker_unit: string;
  marker_date: string;
  marker_purpose: string; // "Diagnosis" | "Confirmation" | "Grading" | "Severity Assessment" | "Follow up" | "Prognosis" | "Monitoring"
  marker_ref_range: string;
  marker_notes: string;
}

export interface ImagingTableEntry {
  imaging_type: string;
  imaging_purpose: string;
  imaging_date: string;
  imaging_parameter: string;
  imaging_findings: string;
  mass_present: string;
  mass_size: string;
  mass_location: string;
  calcifications: string;
  lymph_nodes: string;
  metastasis: string;
  ascites: string;
  pv_status: string;
  sma_status: string;
}

export interface EndoscopyTableEntry {
  endo_type: string;
  endo_purpose: string;
  endo_date: string;
  endo_parameter: string;
  endo_findings: string;
}

export interface OtherInvTableEntry {
  otherinv_type: string;
  otherinv_purpose: string;
  otherinv_date: string;
  otherinv_parameter: string;
  otherinv_findings: string;
}

export interface BiopsyTableEntry {
  biopsy_type: string;
  biopsy_purpose: string;
  biopsy_date: string;
  biopsy_parameter: string;
  biopsy_findings: string;
  biopsy_stage: string;
  lvi: string;
  perineural_invasion: string;
  margin_status: string;
  cell_type: string;
  metastasis: string;
  lymph_nodes: string;
}

export interface ImmunohistochemistryTableEntry {
  ihc_specimen: string;
  ihc_panel: string;
  ihc_marker: string;
  ihc_result: string;
  ihc_intensity: string;
  ihc_percentage: string;
  ihc_score: string;
  ihc_pattern: string;
  ihc_method: string;
  ihc_date: string;
  ihc_purpose: string; // "Diagnosis" | "Confirmation" | "Grading" | "Subtyping" | "Prognosis" | "Therapy Selection"
  ihc_lab: string;
  ihc_pathologist: string;
  ihc_interpretation: string;
  ihc_notes: string;
}

export interface SupplementaryDetailEntry {
  detail_heading: string;
  detail_subheading: string;
  detail_label: string;
  detail_value: string;
  detail_unit: string;
  detail_date: string;
  detail_priority: string;
  detail_category: string;
  detail_source: string;
  detail_notes: string;
}

export interface StagingTableEntry {
  staging_system: string;
  staging_notes: string;
}

export interface ClinicalStagingEntry {
  staging_system: string;
  staging_type: string;
  staging_date: string;
  staging_notes: string;

  // TNM (AJCC / UICC / other TNM-based)
  clinical_t: string;
  clinical_n: string;
  clinical_m: string;
  pathological_t: string;
  pathological_n: string;
  pathological_m: string;
  clinical_stage_group: string;
  pathological_stage_group: string;

  // Non-TNM staging systems
  figo_stage: string;
  ann_arbor_stage: string;
  ann_arbor_modifier: string;
  lugano_stage: string;
  lugano_modifier: string;
  binet_stage: string;
  rai_stage: string;
  child_pugh_grade: string;
  child_pugh_points: string;
  bclc_stage: string;
  dukes_stage: string;
  iss_stage: string;
  riss_stage: string;
  gleason_score: string;
  gleason_grade_group: string;
  inss_stage: string;
  inrg_stage: string;
  nwts_stage: string;
  masaoka_stage: string;
  who_cns_grade: string;
  chang_stage: string;
  iblp_stage: string;
  hklc_stage: string;
  clark_level: string;
  breslow_thickness: string;
}

export interface HistologyGradingEntry {
  grading_system: string;
  grading_date: string;
  grading_notes: string;

  // Universal grading
  histological_grade: string;
  histological_grade_description: string;
  differentiation: string;
  nuclear_grade: string;
  mitotic_count: string;
  mitotic_score: string;
  ki67_percentage: string;
  lymphovascular_invasion: string;
  perineural_invasion: string;
  tumor_budding: string;
  necrosis: string;
  cellularity: string;

  // Breast cancer — Nottingham (Elston-Ellis) / Bloom-Richardson
  nottingham_score: string;
  nottingham_grade: string;
  nottingham_tubule_score: string;
  nottingham_nuclear_score: string;
  nottingham_mitotic_score: string;

  // Renal — Fuhrman / ISUP / WHO-ISUP
  fuhrman_grade: string;
  isup_grade: string;
  who_isup_grade: string;

  // Prostate — Gleason (repeated here for dedicated grading context)
  gleason_primary: string;
  gleason_secondary: string;
  gleason_score: string;
  gleason_grade_group: string;

  // Endometrial / Ovarian — FIGO grade
  figo_grade: string;

  // CNS — WHO grade
  who_cns_grade: string;

  // Lung / others
  lepidic_pattern: string;
  acinar_pattern: string;
  papillary_pattern: string;
  micropapillary_pattern: string;
  solid_pattern: string;

  // GI / Pancreatobiliary
  tumor_differentiation: string;
  mucinous_component: string;
  signet_ring_cells: string;
  medullary_features: string;

  // Sarcoma
  sarcoma_grade: string;
  mitoses_per_10hpf: string;
  tumor_necrosis_percentage: string;
}

export interface PreOperativeAssessmentEntry {
  surgery_name: string;
  assessment_date: string;

  // Pre-op lab values
  lab_hb: string;
  lab_wbc: string;
  lab_platelets: string;
  lab_creatinine: string;
  lab_egfr: string;
  lab_albumin: string;
  lab_inr: string;
  lab_aptt: string;
  lab_alt: string;
  lab_ast: string;
  lab_bilirubin: string;
  lab_crp: string;
  lab_troponin: string;
  lab_bnp: string;
  lab_blood_group: string;
  lab_other: string;

  // Baseline imaging
  baseline_imaging_type: string;
  baseline_imaging_date: string;
  baseline_imaging_findings: string;

  // Surgical candidacy
  surgical_candidacy: string;
  surgical_candidacy_notes: string;

  // Anesthetic risk (ASA)
  asa_class: string;
  asa_notes: string;

  // Margin status expectation
  margin_status_expectation: string;
  margin_notes: string;

  // Expected extent of resection
  expected_resection_extent: string;
  expected_resection_notes: string;

  // Expected lymphadenectomy
  expected_lymphadenectomy: string;
  expected_lymph_node_levels: string;
  expected_lymph_node_count: string;

  // Cardiac assessment
  cardiac_assessment_status: string;
  cardiac_ecg_findings: string;
  cardiac_echo_findings: string;
  cardiac_risk_stratification: string;
  cardiac_clearance: string;
  cardiac_notes: string;
  // RCRI components (auto-calc → risk_stratification)
  rcri_high_risk_surgery: string;
  rcri_ischemic_heart_disease: string;
  rcri_heart_failure: string;
  rcri_cerebrovascular_disease: string;
  rcri_insulin_diabetes: string;
  rcri_renal_dysfunction: string;
  rcri_score_auto: string;
  cardiac_risk_manual: string;

  // Pulmonary assessment
  pulmonary_assessment_status: string;
  pulmonary_pft_findings: string;
  pulmonary_imaging_findings: string;
  pulmonary_risk_stratification: string;
  pulmonary_clearance: string;
  pulmonary_notes: string;
  // Pulmonary risk components (auto-calc → risk_stratification)
  pulm_age_risk: string;
  pulm_spo2_risk: string;
  pulm_upper_surgery: string;
  pulm_copd: string;
  pulm_smoking: string;
  pulm_emergency: string;
  pulm_risk_score_auto: string;
  pulmonary_risk_manual: string;

  // Liver assessment
  liver_assessment_status: string;
  liver_child_pugh_score: string;
  liver_child_pugh_grade: string;
  liver_meld_score: string;
  liver_meld_na_score: string;
  liver_albi_grade: string;
  liver_fibrosis_stage: string;
  liver_steatosis: string;
  liver_portal_hypertension: string;
  liver_notes: string;
  // Child-Pugh components (auto-calc → score + grade)
  cp_bilirubin: string;
  cp_albumin: string;
  cp_inr: string;
  cp_ascites: string;
  cp_encephalopathy: string;
  cp_score_auto: string;
  cp_grade_auto: string;
  child_pugh_manual: string;

  // Kidney assessment
  kidney_assessment_status: string;
  kidney_ckd_stage: string;
  kidney_egfr_category: string;
  kidney_rifle_stage: string;
  kidney_akin_stage: string;
  kidney_kdigo_stage: string;
  kidney_urine_acr: string;
  kidney_proteinuria: string;
  kidney_notes: string;

  // Metabolic risk assessment
  metabolic_diabetes_status: string;
  metabolic_hba1c: string;
  metabolic_nutritional_status: string;
  metabolic_risk_stratification: string;
  metabolic_notes: string;
  // Metabolic risk components (auto-calc)
  met_waist_cm: string;
  met_bp_systolic: string;
  met_bp_diastolic: string;
  met_hdl: string;
  met_triglycerides: string;
  met_fasting_glucose: string;
  met_components_count: string;
  metabolic_risk_manual: string;

  // Immunological assessment
  immunological_status: string;
  immunological_neutrophil_count: string;
  immunological_lymphocyte_count: string;
  immunological_hiv_status: string;
  immunological_steroid_use: string;
  immunological_other_immunosuppression: string;
  immunological_notes: string;

  // POSSUM predictive risk
  possum_physiological_score: string;
  possum_operative_severity: string;
  possum_predicted_morbidity: string;
  possum_predicted_mortality: string;
  possum_notes: string;
  // POSSUM components (auto-calc → scores)
  possum_age_score: string;
  possum_cardiac_signs: string;
  possum_respiratory_signs: string;
  possum_sbp: string;
  possum_pulse_rate: string;
  possum_gcs_score: string;
  possum_urea_val: string;
  possum_na_val: string;
  possum_k_val: string;
  possum_hb_val: string;
  possum_wbc_val: string;
  possum_ecg_abnormal: string;
  possum_operative_multiple: string;
  possum_blood_loss_ml: string;
  possum_peritoneal_soiling: string;
  possum_malignancy_present: string;
  possum_urgency: string;
  possum_phys_score_auto: string;
  possum_op_score_auto: string;
  possum_pred_morbidity_auto: string;
  possum_pred_mortality_auto: string;
  possum_phys_manual: string;
  possum_op_manual: string;

  // Neo-adjuvant chemo response
  neoadj_chemo_received: string;
  neoadj_chemo_regimen: string;
  neoadj_chemo_cycles: string;
  neoadj_chemo_completion_date: string;
  neoadj_chemo_response: string; // RECIST / pathologic response
  neoadj_chemo_response_details: string;
  // Chemo RECIST components (auto-calc)
  neoadj_target_count: string;
  neoadj_target_sum_before: string;
  neoadj_target_sum_after: string;
  neoadj_pct_change_auto: string;
  neoadj_chemo_manual: string;

  // Neo-adjuvant radio response
  neoadj_radio_received: string;
  neoadj_radio_regimen: string;
  neoadj_radio_dose: string;
  neoadj_radio_completion_date: string;
  neoadj_radio_response: string;
  neoadj_radio_response_details: string;
  neoadj_radio_manual: string;

  // Organ-specific resistance testing
  organ_resistance_testing: string;
  organ_resistance_results: string;
  organ_resistance_notes: string;

  // MDT discussion
  mdt_date: string;
  mdt_participants: string;
  mdt_recommendation: string;
  mdt_decision: string;
  mdt_notes: string;

  // Additional configurable lab values
  additional_labs: PreOpAdditionalLabEntry[];
  // Additional imaging entries
  additional_imaging: PreOpAdditionalImagingEntry[];
}

export interface PreOpAdditionalLabEntry {
  test_name: string;
  result: string;
  unit: string;
  reference_range: string;
}

export interface PreOpAdditionalImagingEntry {
  imaging_type: string;
  imaging_date: string;
  imaging_findings: string;
}

export interface IntraopImagingEntry {
  imaging_type: string;
  imaging_findings: string;
}

export interface PostOpParamEntry {
  parameter: string;
  finding: string;
}

export interface PostOpMonitoringEntry {
  postop_day: string;
  date: string;
  parameters: PostOpParamEntry[];
}

export interface PostOpComplicationEntry {
  complication_name: string;
  occurrence_date: string;
  days_postop: string;
}

export interface TumorCharacteristicFinding {
  parameter: string;
  finding: string;
  source: "Manual" | "AI";
}

export interface TumorCharacteristicsEntry {
  tumour_sites: string;
  laterality: string;
  primary_count: string;
  tumor_size_length: string;
  tumor_size_width: string;
  tumor_size_depth: string;
  tumor_size_unit: string;
  macroscopic_features: string;
  specimen_type: string;
  diagnostic_modality_parameter: string;
  diagnostic_modality: string;
  sampling_confirmation: string;
  histological_type_parameter: string;
  histological_type: string;
  histological_grade: string;
  histological_info: string;
  cell_morphology_parameter: string;
  cell_morphology: string;
  tumor_differentiation_status: string;
  microscopic_size: string;
  microscopic_features: string;
  lvi: string;
  perineural_invasion: string;
  margin_status: string;
  mitotic_rate: string;
  tumor_infiltrating_lymphocytes: string;
  stroma_percentage: string;
  tumor_associated_macrophages: string;
  nodal_metastasis_details: string;
  distant_metastasis_details: string;
  synchronous_malignancy: string;
  metachronous_malignancy: string;
  diagnosis_date: string;
  pathological_interpretation: string;
  pathology_reporting_status: string;
  pathology_reporting_date: string;
  risk_stratification: string;
  genomic_risk_score: string;
  biology_summary: string;
  molecular_markers_parameter: string;
  molecular_markers: string;
  molecular_markers_entries: TumorCharacteristicFinding[];
  immunohistochemistry_parameter: string;
  immunohistochemistry: string;
  immunohistochemistry_entries: TumorCharacteristicFinding[];
  genomic_testing_parameter: string;
  genomic_testing: string;
  genomic_testing_entries: TumorCharacteristicFinding[];
  gene_expression_profile_parameter: string;
  gene_expression_profile: string;
  gene_expression_profile_entries: TumorCharacteristicFinding[];
  viral_status_parameter: string;
  viral_status: string;
}

export interface ProblemTableEntry {
  problem: string;
  management_plan: string;
}

export interface CommonDrugsTableEntry {
  common_drug: string;
  common_dose: string;
  common_frequency: string;
  common_drug_notes: string;
}

export interface NeoChemoTableEntry {
  neo_chemo_drug: string;
  neo_chemo_dose: string;
  neo_chemo_freq: string;
  neo_chemo_route: string;
  neo_chemo_cycles: string;
  neo_chemo_effects: string;
  neo_chemo_notes: string;
}

export interface NeoRadioTableEntry {
  neo_radio_comp: string;
  neo_radio_dose: string;
  neo_radio_freq: string;
  neo_radio_route: string;
  neo_radio_cycles: string;
  neo_radio_effects: string;
  neo_radio_notes: string;
}

export interface SurgeryTableEntry {
  surgery_name: string;
  surgery_date: string;
  surgery_site: string;
  surgery_approach: string;
  surgery_findings: string;
  drain_status: string;
  drain_volume: string;
  surgery_notes: string;
}

export interface DefinitiveSurgeryEntry {
  surgery_name: string;
  surgery_date: string;
  surgeon_name: string;
  surgeon_specialty: string;
  surgeon_volume: string;
  hospital_name: string;
  surgery_type: string;
  surgery_intent: string;
  surgery_phase: string;
  surgery_timing: string;
  preop_diagnosis: string;
  indication_for_surgery: string;
  anesthesia_type: string;
  operative_duration_min: string;
  incision_to_closure: string;
  estimated_blood_loss_ml: string;
  intraop_fluids_ml: string;
  intraop_blood_transfusion: string;
  intraop_complications: string;
  intraop_findings: string;
  specimen_description: string;
  intraop_imaging: string;
  intraop_imaging_list: IntraopImagingEntry[];
  surgery_approach: string;
  surgery_site: string;
  procedure_details: string;
  resection_status: string;
  margin_status: string;
  closest_margin_mm: string;
  lymph_node_dissection: string;
  lymph_node_harvested: string;
  lymph_node_positive: string;
  organ_resection_details: string;
  multi_visceral_resection: string;
  sentinel_node_biopsy: string;
  sentinel_node_biopsy_results: string;
  neoadj_effect_details: string;
  en_bloc_resection: string;
  depth_of_invasion: string;
  resected_specimen_size: string;
  conversion_to_open: string;
  reconstruction_type: string;
  reconstruction_details: string;
  postop_diagnosis: string;
  recovery_status: string;
  discharge_date: string;
  discharge_status: string;
  readmission_30d: string;
  readmission_reason: string;
  pathology_specimen_id: string;
  pathology_link: string;
  surgery_notes: string;
}

export interface TreatmentOutcomeEntry {
  assessment_date: string;
  response_evaluation_criteria: string;
  overall_response: string;
  target_lesion_response: string;
  non_target_lesion_response: string;
  new_lesions: string;
  progression_date: string;
  recurrence_status: string;
  recurrence_date: string;
  recurrence_location: string;
  survival_status: string;
  survival_date: string;
  cause_of_death: string;
  ecog_status: string;
  tumor_markers_followup: string;
  imaging_followup: string;
  outcome_notes: string;

  // Surgery Outcome sub-panel
  hospital_entry_date: string;
  hospital_exit_date: string;
  hospital_stay_days: string;
  icu_admission: string;
  icu_admit_date: string;
  icu_exit_date: string;
  icu_stay_days: string;
  return_to_or_30d: string;
  transfusion_needed: string;
  transfusion_type: string;
  transfusion_amount: string;
  wound_infection: string;
  anastomotic_leak: string;
  thromboembolic_events: string;
  cardiac_complication: string;
  cardiac_complication_details: string;
  pulmonary_complication: string;
  pulmonary_complication_details: string;
  acute_kidney_injury: string;
  hepatic_dysfunction: string;
  anastomotic_stricture: string;
  lymphoedema: string;
  seroma_hematoma: string;
  nerve_injury: string;
  fistula_formation: string;
  sepsis_development: string;
  mortality_90d: string;
  mortality_1y: string;
  mortality_30d: string;
  unplanned_readmission: string;
  discharge_destination: string;
  clavien_dindo_grade: string;
  clavien_dindo_criteria: string;
  severe_complication_rate_criteria: string;
  icu_management_details: string;
  ward_management_details: string;
  postop_monitoring: PostOpMonitoringEntry[];
  postop_complications: PostOpComplicationEntry[];
  reference_surgery_date: string;
}

export interface ComplicationTableEntry {
  complication: string;
  post_op_duration: string;
  management: string;
  notes: string;
}

export interface MonitoringTableEntry {
  monitor_param: string;
  monitor_duration: string;
  monitor_findings: string;
  monitor_notes: string;
}

export interface IcuTableEntry {
  icu_date: string;
  icu_stay: string;
  icu_mgmt: string;
  icu_exit: string;
  icu_notes: string;
}

export interface WardTableEntry {
  ward_entry: string;
  ward_stay: string;
  ward_mgmt: string;
  ward_exit: string;
  ward_notes: string;
}

export interface AfterSurgicalTherapyEntry {
  therapy_type: string;
  start_date: string;
  end_date: string;
  regimen: string;
  cycles_dose: string;
  details: string;
  notes: string;
  diagnosis_date_ref: string;
  first_therapy_date: string;
  days_diag_to_therapy: string;
  chemo_dose_intensity: string;
  chemo_toxicity_grade: string;
  radiation_dose_modifications: string;
  treatment_adherence: string;
  treatment_related_mortality: string;
  late_toxicity: string;
}

export interface AdjuvantTherapyEntry {
  therapy_type: string;
  date_of_commencement: string;
  regimen: string;
  cycles_dose: string;
  details: string;
  notes: string;
}

export interface FollowUpPrognosisEntry {
  second_cancer_development: string;
  second_cancer_details: string;
  cancer_specific_survival: string;
  conditional_survival_details: string;
  qol_assessment_done: string;
  qol_score_system: string;
  qol_parameters: string;
  qol_score: string;
  functional_recovery: string;
  genetic_review_done: string;
  genetic_review_details: string;
  clinical_trial_enrollment: string;
  clinical_trial_details: string;
  readmission_30d: string;
  readmission_90d: string;
  follow_up_notes: string;
}

export interface OncologicalOutcomeEntry {
  assessment_date: string;
  response_evaluation_criteria: string;
  overall_response: string;
  target_lesion_response: string;
  non_target_lesion_response: string;
  new_lesions: string;
  progression_date: string;
  recurrence_status: string;
  recurrence_date: string;
  recurrence_location: string;
  survival_status: string;
  survival_date: string;
  cause_of_death: string;
  ecog_status: string;
  tumor_markers_followup: string;
  imaging_followup: string;
  outcome_notes: string;
}

export interface UnmappedMedicalInformationEntry {
  source_section: string;
  detail: string;
  medical_importance: "high" | "medium" | "low";
}

export interface SourceFileSummaryEntry {
  file_name: string;
  document_type: string;
  clinically_relevant_summary: string;
  unclear_or_unreadable_parts: string;
}

export interface DocumentExtractionBackupEntry {
  document_name: string;
  extraction_date: string;
  extraction_time: string;
  raw_extracted_data: string;
  file_reference: string;
}

export interface PatientRecord {
  id: string; // local firestore document id / custom auto_id
  isDeleted?: boolean;
  
  // Basic Details Section
  oncology: OncologyCategory;
  oncology_types: string[];
  oncology_other?: string;
  date: string; // date of registration/entry
  auto_id: string;
  tp: string; // telephone number
  nic: string; // NIC card number
  title: string; // e.g. "Mr.", "Mrs.", "Ms.", "Miss.", "Dr.", "Prof.", "Rev."
  initials: string;
  first_name: string;
  last_name: string;
  bht: string; // clinic book reference
  clinic: string;
  dob: string;
  age: string | number;
  gender: string;
  living_area: string;
  hospital: string;
  hospital_location: string;
  hospital_type: string;
  ward_no: string;
  marital_status: string;
  education_status: string;
  ethnicity: string;
  occupation: string;
  geographic_accessibility: string;
  status: PatientStatus;

  // History & Presentations
  presenting_complaints: string;
  presentingComplaintsTable: PresentingComplaintEntry[];
  pastMedicalTable: PastMedicalEntry[];
  pastSurgicalTable: PastSurgicalEntry[];
  priorChemoTable: PriorTreatmentEntry[];
  priorRadioTable: PriorTreatmentEntry[];
  priorImmunoTable: PriorTreatmentEntry[];
  priorHormoneTable: PriorTreatmentEntry[];
  priorTargetedTable: PriorTreatmentEntry[];
  charlson_index: string;
  charlson_conditions: string;
  comorbidity: string;
  hospital_admissions: string;
  ecog_status: string;
  functional_adl_score: string;
  functional_adl_items: string;
  functional_iadl_score: string;
  functional_iadl_items: string;
  past_surgical_history: string;

  // Tables
  drugTable: DrugTableEntry[];
  
  // Allergies
  allergy_food: string;
  allergy_drugs: string;
  allergy_plasters: string;
  allergy_other: string;

  familyTable: FamilyTableEntry[];

  // Social habits
  smoking: string;
  smoking_amount: string;
  alcohol: string;
  alcohol_amount: string;

  riskTable: RiskTableEntry[];

  // Physical parameters
  bmi: string;
  bsa: string;
  height: string;
  weight: string;
  exam_findings: string;
  systemic_exam: string;
  examFindingsTable: ExamFindingsGroup[];
  systemicInquiry: SystemicInquiryEntry[];
  anthropometricTable: AnthropometricEntry[];
  otherAnthropometricTable: OtherAnthropometricGroup[];

  // Diagnoses & staging
  provisional_diagnosis: string;
  bloodTable: BloodTableEntry[];
  tumorMarkersTable: TumorMarkerTableEntry[];
  imagingTable: ImagingTableEntry[];
  endoscopyTable: EndoscopyTableEntry[];
  otherInvTable: OtherInvTableEntry[];
  geneticTable: GeneticTestEntry[];
  contrastTable: ContrastStudyEntry[];
  biopsyTable: BiopsyTableEntry[];
  immunohistochemistryTable: ImmunohistochemistryTableEntry[];
  supplementaryDetailsTable: SupplementaryDetailEntry[];
  stagingTable: StagingTableEntry[];
  clinicalStagingTable: ClinicalStagingEntry[];
  histologyGradingTable: HistologyGradingEntry[];
  preOperativeAssessmentTable: PreOperativeAssessmentEntry[];
  overall_stage: string;
  tnm_stage: string;
  final_diagnosis: string;
  definitiveDiagnosisTable: DefinitiveDiagnosisEntry[];
  diagnosis_delay_days: string;

  // Tumour characteristics
  tumorCharacteristicsTable: TumorCharacteristicsEntry[];
  tumor_tumour_sites: string;
  tumor_histological_type_parameter: string;
  tumor_histological_type: string;
  tumor_histological_grade: string;
  tumor_diagnosis_date: string;
  tumor_diagnostic_modality_parameter: string;
  tumor_diagnostic_modality: string;
  tumor_laterality: string;
  tumor_primary_count: string;
  tumor_synchronous_malignancy: string;
  tumor_metachronous_malignancy: string;
  tumor_molecular_markers_parameter: string;
  tumor_molecular_markers: string;
  tumor_immunohistochemistry_parameter: string;
  tumor_immunohistochemistry: string;
  tumor_genomic_testing_parameter: string;
  tumor_genomic_testing: string;
  tumor_gene_expression_profile_parameter: string;
  tumor_gene_expression_profile: string;
  tumor_viral_status_parameter: string;
  tumor_viral_status: string;
  tumor_cell_morphology_parameter: string;
  tumor_cell_morphology: string;
  tumor_biology_summary: string;
  tumor_sampling_confirmation: string;

  // Care Management
  problemTable: ProblemTableEntry[];
  commonDrugsTable: CommonDrugsTableEntry[];

  // Neo-adjuvant Chemotherapy
  neo_chemo_status: string;
  neoChemoTable: NeoChemoTableEntry[];

  // Adjuvant Chemotherapy
  adj_chemo_status: string;
  adjChemoTable: NeoChemoTableEntry[];

  // Neo-adjuvant Radiotherapy
  neo_radio_status: string;
  neoRadioTable: NeoRadioTableEntry[];

  // Adjuvant Radiotherapy
  adj_radio_status: string;
  adjRadioTable: NeoRadioTableEntry[];

  // Surgeries
  surgeryTable: SurgeryTableEntry[];
  definitiveSurgeryTable: DefinitiveSurgeryEntry[];
  treatmentOutcomeTable: TreatmentOutcomeEntry[];
  afterSurgicalTherapiesTable: AfterSurgicalTherapyEntry[];
  adjuvantTherapyTable: AdjuvantTherapyEntry[];
  followUpPrognosisTable: FollowUpPrognosisEntry[];
  oncologicalOutcomeTable: OncologicalOutcomeEntry[];
  complicationTable: ComplicationTableEntry[];
  monitoringTable: MonitoringTableEntry[];
  
  // ICU & Ward
  icu_done: string;
  icuTable: IcuTableEntry[];
  wardTable: WardTableEntry[];

  // Notes
  follow_up_notes: string;
  general_notes: string;

  // AI Unmapped summaries & parameters
  unmapped_medical_information: UnmappedMedicalInformationEntry[];
  document_extraction_backups: DocumentExtractionBackupEntry[];
  source_file_summaries: SourceFileSummaryEntry[];
  extraction_safety_note: string;
  consent_ai_processing?: boolean;

  // Timestamp tracking
  createdAt: string;
  updatedAt: string;
}

// Drive Virtual File System
export interface DiskFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadDate: string;
  patientId: string;
  extracted: boolean;
  contentBase64?: string; // stored for simulation/download
  isDeleted?: boolean;
  webViewLink?: string;
  webContentLink?: string;
  driveFileId?: string;
}

export interface UserAccount {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "user";
  avatarColor: string;
}
