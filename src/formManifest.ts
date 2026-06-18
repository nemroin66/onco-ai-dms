export interface ManifestField {
  type: "text" | "number" | "date" | "select" | "textarea" | "multi-select" | "radio" | "readonly" | "checkbox-group";
  options?: string[];
  dependsOn?: string;
  isArray?: boolean;
  itemFields?: Record<string, ManifestField>;
}

export interface ManifestSection {
  key: string;
  label: string;
  tableKey?: string;
  fields: Record<string, ManifestField>;
}

export interface FormManifest {
  sections: Record<string, ManifestSection>;
}

const MANIFEST: FormManifest = {
  sections: {
    patientIdentifiers: {
      key: "patientIdentifiers", label: "Patient Identifiers",
      fields: {
        id: { type: "readonly" },
        auto_id: { type: "readonly" },
        tp: { type: "text" },
        title: { type: "select", options: ["Mr.", "Mrs.", "Ms.", "Miss.", "Dr.", "Prof.", "Rev."] },
        initials: { type: "text" },
        first_name: { type: "text" },
        last_name: { type: "text" },
        nic: { type: "text" },
        clinic: { type: "text" },
        bht: { type: "text" },
      }
    },
    demographics: {
      key: "demographics", label: "Demographics",
      fields: {
        dob: { type: "date" },
        age: { type: "readonly" },
        gender: { type: "select", options: ["Male", "Female", "Non-binary"] },
        status: { type: "select", options: ["active", "under_treatment", "follow_up", "discharged"] },
        marital_status: { type: "select", options: ["Single", "Married", "Separated", "Divorced", "Widowed"] },
        education_status: { type: "select", options: ["No formal education", "Primary school", "Secondary school", "High school / GED", "Vocational / Technical", "Diploma", "Bachelor's degree", "Master's degree", "Doctorate / PhD", "Professional degree"] },
        ethnicity: { type: "select", options: ["Sinhalese", "Sri Lankan Tamil", "Indian Tamil", "Sri Lankan Moor", "Malay", "Burgher", "Chinese", "South Asian", "East Asian", "Southeast Asian", "Middle Eastern", "African", "Caucasian / White", "Hispanic / Latino", "Mixed / Multiracial", "Other"] },
        geographic_accessibility: { type: "select", options: ["Urban", "Semi-urban", "Rural", "Remote", "Not applicable"] },
        living_area: { type: "text" },
        occupation: { type: "text" },
      }
    },
    oncology: {
      key: "oncology", label: "Oncology Types",
      fields: {
        oncology_types: { type: "multi-select" },
        oncology: { type: "text" },
        oncology_other: { type: "text" },
      }
    },
    hospital: {
      key: "hospital", label: "Hospital Information",
      fields: {
        hospital: { type: "text" },
        hospital_location: { type: "text" },
        hospital_type: { type: "select", options: ["National Hospital", "Teaching Hospital", "Provincial Hospital", "District Hospital", "Base Hospital", "Government", "Semi-government", "Private"] },
        ward_no: { type: "text" },
      }
    },
    history: {
      key: "history", label: "Clinical History",
      fields: {
        presenting_complaints: { type: "textarea" },
        presentingComplaintsTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, complaint: { type: "text" }, notes: { type: "text" } } },
        pastMedicalTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, comorbidity: { type: "text" }, notes: { type: "text" } } },
        pastSurgicalTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, surgery: { type: "text" }, complication: { type: "text" }, notes: { type: "text" } } },
        comorbidity: { type: "textarea" },
        hospital_admissions: { type: "textarea" },
        past_surgical_history: { type: "textarea" },
        priorChemoTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, agent: { type: "text" }, dose: { type: "text" }, frequency: { type: "text" }, duration: { type: "text" }, cancer_type: { type: "text" }, adverse_effects: { type: "text" }, notes: { type: "text" } } },
        priorRadioTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, agent: { type: "text" }, dose: { type: "text" }, frequency: { type: "text" }, duration: { type: "text" }, cancer_type: { type: "text" }, adverse_effects: { type: "text" }, notes: { type: "text" } } },
        priorImmunoTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, agent: { type: "text" }, dose: { type: "text" }, frequency: { type: "text" }, duration: { type: "text" }, cancer_type: { type: "text" }, adverse_effects: { type: "text" }, notes: { type: "text" } } },
        priorHormoneTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, agent: { type: "text" }, dose: { type: "text" }, frequency: { type: "text" }, duration: { type: "text" }, cancer_type: { type: "text" }, adverse_effects: { type: "text" }, notes: { type: "text" } } },
        priorTargetedTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, agent: { type: "text" }, dose: { type: "text" }, frequency: { type: "text" }, duration: { type: "text" }, cancer_type: { type: "text" }, adverse_effects: { type: "text" }, notes: { type: "text" } } },
        drugTable: { type: "text", isArray: true, itemFields: { drug_name: { type: "text" }, dose: { type: "text" }, frequency: { type: "text" }, route: { type: "text" }, duration: { type: "text" }, notes: { type: "text" } } },
        smoking: { type: "select", options: ["Non-consumer", "Current consumer", "Ex consumer"] },
        smoking_amount: { type: "text" },
        alcohol: { type: "select", options: ["Non-consumer", "Current consumer", "Ex consumer"] },
        alcohol_amount: { type: "text" },
        riskTable: { type: "text", isArray: true, itemFields: { risk_factor: { type: "text" }, risk_notes: { type: "text" } } },
        allergy_food: { type: "text" },
        allergy_drugs: { type: "text" },
        allergy_plasters: { type: "text" },
        allergy_other: { type: "text" },
        familyTable: { type: "text", isArray: true, itemFields: { comorbidity: { type: "text" }, relationship: { type: "text" }, family_notes: { type: "text" } } },
        charlson_index: { type: "readonly" },
        charlson_conditions: { type: "text" },
      }
    },
    clinicalAssessment: {
      key: "clinicalAssessment", label: "Clinical Assessment",
      fields: {
        systemicInquiry: { type: "text", isArray: true, itemFields: { system: { type: "text" }, symptoms: { type: "multi-select" } } },
        ecog_status: { type: "radio", options: ["0", "1", "2", "3", "4", "5"] },
        functional_adl_score: { type: "readonly" },
        functional_adl_items: { type: "text" },
        functional_iadl_score: { type: "readonly" },
        functional_iadl_items: { type: "text" },
      }
    },
    anthropometric: {
      key: "anthropometric", label: "Anthropometric Measures",
      fields: {
        bmi: { type: "readonly" },
        bsa: { type: "readonly" },
        height: { type: "number" },
        weight: { type: "number" },
        anthropometricTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, height: { type: "number" }, weight: { type: "number" }, bmi: { type: "readonly" }, bsa: { type: "readonly" } } },
        otherAnthropometricTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, entries: { type: "text", isArray: true, itemFields: { measure: { type: "select", options: ["Waist circumference", "Hip circumference", "Mid-upper arm circumference (MUAC)", "Head circumference", "Neck circumference", "Chest circumference", "Thigh circumference", "Calf circumference", "Skinfold thickness (triceps)", "Skinfold thickness (subscapular)", "Skinfold thickness (suprailiac)", "Arm span", "Sitting height", "Waist-to-hip ratio"] }, value: { type: "number" }, unit: { type: "select", options: ["cm", "mm", "kg", "m", "in", "ft"] } } } } },
      }
    },
    examination: {
      key: "examination", label: "Examination Findings",
      fields: {
        exam_findings: { type: "textarea" },
        systemic_exam: { type: "textarea" },
        examFindingsTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, entries: { type: "text", isArray: true, itemFields: { organ_system: { type: "select", options: ["General Appearance", "ECOG / Performance Status", "BP", "Pulse (Rate & Rhythm)", "SpO2", "Temperature", "Respiratory Rate", "Head & Neck", "Eyes / Ophthalmic", "Ears", "Nose & Sinuses", "Oral Cavity & Throat", "Lymph Nodes", "RS (Respiratory)", "Breast Exam", "CVS (Cardiovascular)", "Peripheral Vascular", "Varicose Veins", "P/A (Per Abdomen)", "Groin & Hernia", "Rectal / DRE", "CNS (Neurological)", "Cranial Nerves", "Cerebellar Examination", "Sensory Examination", "Upper Limbs", "Lower Limbs", "Radial Nerve", "Median Nerve", "Axillary Nerve", "Carpal Tunnel", "Sciatic Nerve", "Common Peroneal Nerve", "MSK (Musculoskeletal)", "Knee", "Hip", "Spine", "TMJ", "Skin", "Local / Lesion Exam", "Lumps & Bumps"] }, findings: { type: "text" }, notes: { type: "text" } } } } },
      }
    },
    provisionalDiagnosis: {
      key: "provisionalDiagnosis", label: "Provisional Diagnosis",
      fields: {
        provisional_diagnosis: { type: "textarea" },
      }
    },
    definitiveDiagnosis: {
      key: "definitiveDiagnosis", label: "Definitive Diagnosis",
      fields: {
        final_diagnosis: { type: "textarea" },
        definitiveDiagnosisTable: { type: "text", isArray: true, itemFields: { date: { type: "date" }, diagnosis: { type: "text" }, notes: { type: "text" } } },
        diagnosis_delay_days: { type: "readonly" },
      }
    },
    investigations: {
      key: "investigations", label: "Medical Investigations",
      fields: {
        overall_stage: { type: "text" },
        tnm_stage: { type: "text" },
        bloodTable: { type: "text", isArray: true, itemFields: { blood_type: { type: "text" }, blood_purpose: { type: "text" }, blood_date: { type: "date" }, blood_findings: { type: "text" }, blood_notes: { type: "text" } } },
        tumorMarkersTable: { type: "text", isArray: true, itemFields: { marker_name: { type: "text" }, marker_value: { type: "text" }, marker_unit: { type: "text" }, marker_date: { type: "date" }, marker_purpose: { type: "text" }, marker_ref_range: { type: "text" }, marker_notes: { type: "text" } } },
        imagingTable: { type: "text", isArray: true, itemFields: { imaging_type: { type: "text" }, imaging_purpose: { type: "text" }, imaging_date: { type: "date" }, imaging_parameter: { type: "text" }, imaging_findings: { type: "text" }, mass_present: { type: "select", options: ["Yes", "No", "Suspicious"] }, mass_size: { type: "text" }, mass_features: { type: "text" }, mass_location: { type: "text" }, anatomical_site: { type: "text" }, calcifications: { type: "text" }, lymph_nodes: { type: "text" }, metastasis: { type: "text" }, mets_features: { type: "text" }, ascites: { type: "select", options: ["Absent", "Mild", "Moderate", "Severe"] }, venous_obstruction: { type: "select", options: ["Absent", "Present", "Suspected", "Not assessed"] }, pv_status: { type: "text" }, sma_status: { type: "text" }, other_findings: { type: "text" } } },
        endoscopyTable: { type: "text", isArray: true, itemFields: { endo_type: { type: "text" }, endo_purpose: { type: "text" }, endo_date: { type: "date" }, endo_parameter: { type: "text" }, endo_findings: { type: "text" } } },
        otherInvTable: { type: "text", isArray: true, itemFields: { otherinv_type: { type: "text" }, otherinv_purpose: { type: "text" }, otherinv_date: { type: "date" }, otherinv_parameter: { type: "text" }, otherinv_findings: { type: "text" } } },
        geneticTable: { type: "text", isArray: true, itemFields: { test_name: { type: "text" }, gene: { type: "text" }, variant: { type: "text" }, result: { type: "text" }, method: { type: "text" }, date: { type: "date" }, purpose: { type: "text" }, notes: { type: "text" } } },
        contrastTable: { type: "text", isArray: true, itemFields: { study_type: { type: "text" }, contrast_agent: { type: "text" }, body_part: { type: "text" }, findings: { type: "text" }, date: { type: "date" }, purpose: { type: "text" }, notes: { type: "text" } } },
        biopsyTable: { type: "text", isArray: true, itemFields: { biopsy_type: { type: "text" }, biopsy_purpose: { type: "text" }, biopsy_date: { type: "date" }, biopsy_parameter: { type: "text" }, biopsy_findings: { type: "text" }, macroscopic_size: { type: "text" }, microscopic_size: { type: "text" }, histological_type: { type: "text" }, histological_grade: { type: "select", options: ["G1 - Well differentiated", "G2 - Moderately differentiated", "G3 - Poorly differentiated", "G4 - Undifferentiated / Anaplastic", "Low grade", "Intermediate grade", "High grade", "Not applicable", "Unknown"] }, histological_info: { type: "text" }, biopsy_stage: { type: "text" }, lvi: { type: "select", options: ["Absent", "Present", "Suspected", "Not assessed"] }, perineural_invasion: { type: "select", options: ["Absent", "Present", "Suspected", "Not assessed"] }, margin_status: { type: "select", options: ["Negative", "Positive", "Close", "Not assessed"] }, cell_type: { type: "text" }, metastasis: { type: "text" }, lymph_nodes: { type: "text" } } },
        immunohistochemistryTable: { type: "text", isArray: true, itemFields: { ihc_specimen: { type: "text" }, ihc_panel: { type: "text" }, ihc_marker: { type: "text" }, ihc_result: { type: "select", options: ["Positive", "Negative", "Equivocal", "Not done"] }, ihc_intensity: { type: "select", options: ["0", "1+", "2+", "3+"] }, ihc_percentage: { type: "text" }, ihc_score: { type: "text" }, ihc_pattern: { type: "text" }, ihc_cell_type: { type: "text" }, ihc_anatomical_site: { type: "text" }, ihc_method: { type: "text" }, ihc_date: { type: "date" }, ihc_purpose: { type: "text" }, ihc_lab: { type: "text" }, ihc_pathologist: { type: "text" }, ihc_interpretation: { type: "text" }, ihc_notes: { type: "text" } } },
        stagingTable: { type: "text", isArray: true, itemFields: { staging_system: { type: "text" }, staging_notes: { type: "text" } } },
      }
    },
    tumorCharacteristics: {
      key: "tumorCharacteristics", label: "Tumor Characteristics", tableKey: "tumorCharacteristicsTable",
      fields: {
        tumorCharacteristicsTable: { type: "text", isArray: true, itemFields: {
          tumour_sites: { type: "text" },
          // === Macroscopic (Gross Pathology) ===
          laterality: { type: "select", options: ["Right", "Left", "Bilateral", "Midline", "Unilateral NOS", "Not applicable", "Unknown"] },
          primary_count: { type: "select", options: ["Single primary", "Multifocal", "Multicentric", "Multiple primary tumours", "Unknown"] },
          tumor_size_length: { type: "number" },
          tumor_size_width: { type: "number" },
          tumor_size_depth: { type: "number" },
          tumor_size_unit: { type: "select", options: ["mm", "cm"] },
          macroscopic_features: { type: "text" },
          specimen_type: { type: "select", options: ["Core needle biopsy", "Incisional biopsy", "Excisional biopsy", "Lumpectomy", "Wide local excision", "Segmental resection", "Mastectomy", "Colectomy", "Nephrectomy", "Hysterectomy", "Cystectomy", "Pneumonectomy / Lobectomy", "Lymph node dissection", "Bone marrow trephine", "Cytology / FNAC", "Other"] },
          diagnostic_modality_parameter: { type: "select", options: ["Histopathology / Biopsy", "Cytology / FNAC", "Surgical Resection Specimen", "Imaging", "Endoscopy", "Bone Marrow Examination", "Molecular / Genetic Test", "Clinical Diagnosis", "Other"] },
          diagnostic_modality: { type: "text" },
          sampling_confirmation: { type: "select", options: ["Adequate - complete workup possible", "Limited but diagnostic", "Inadequate / insufficient tissue", "Repeat sampling required", "Not assessed"] },
          // === Microscopic (Histopathology) ===
          histological_type_parameter: { type: "text" },
          histological_type: { type: "text" },
          histological_grade: { type: "select", options: ["G1 - Well differentiated", "G2 - Moderately differentiated", "G3 - Poorly differentiated", "G4 - Undifferentiated / Anaplastic", "Low grade", "Intermediate grade", "High grade", "Not applicable", "Unknown"] },
          histological_info: { type: "text" },
          cell_morphology_parameter: { type: "select", options: ["Conventional", "Papillary", "Mucinous", "Signet Ring Cell", "Clear Cell", "Spindle Cell", "Pleomorphic", "Micropapillary", "Cribriform", "Sarcomatoid", "Other"] },
          cell_morphology: { type: "text" },
          tumor_differentiation_status: { type: "select", options: ["Well differentiated", "Moderately differentiated", "Poorly differentiated", "Undifferentiated / anaplastic", "Not applicable", "Unknown"] },
          microscopic_size: { type: "text" },
          microscopic_features: { type: "text" },
          lvi: { type: "select", options: ["Absent", "Present", "Suspected", "Not assessed"] },
          perineural_invasion: { type: "select", options: ["Absent", "Present", "Suspected", "Not assessed"] },
          margin_status: { type: "select", options: ["Negative", "Positive", "Close", "Not assessed"] },
          mitotic_rate: { type: "text" },
          tumor_infiltrating_lymphocytes: { type: "text" },
          stroma_percentage: { type: "number" },
          tumor_associated_macrophages: { type: "text" },
          // === Nodal & Metastasis ===
          nodal_metastasis_details: { type: "textarea" },
          distant_metastasis_details: { type: "textarea" },
          synchronous_malignancy: { type: "select", options: ["Absent", "Present", "Suspected", "Unknown"] },
          metachronous_malignancy: { type: "select", options: ["Absent", "Present - prior malignancy", "Present - subsequent malignancy", "Unknown"] },
          // === Reporting ===
          diagnosis_date: { type: "date" },
          pathological_interpretation: { type: "textarea" },
          pathology_reporting_status: { type: "select", options: ["Pending", "Preliminary", "Final", "Amended", "Supplementary / addendum", "Not available"] },
          pathology_reporting_date: { type: "date" },
          risk_stratification: { type: "select", options: ["Low risk", "Intermediate risk", "High risk", "Very high risk", "Not assessed", "Unknown"] },
          genomic_risk_score: { type: "text" },
          biology_summary: { type: "textarea" },
          // === Molecular / IHC / Genomic panels ===
          molecular_markers_entries: { type: "text", isArray: true, itemFields: { parameter: { type: "select", options: ["KRAS", "NRAS", "BRAF", "EGFR", "ALK", "ROS1", "TP53", "BRCA1", "BRCA2", "MMR", "MSI", "TMB", "PIK3CA", "IDH1 / IDH2", "NTRK", "Other"] }, finding: { type: "text" }, source: { type: "select", options: ["Manual", "AI"] } } },
          immunohistochemistry_entries: { type: "text", isArray: true, itemFields: { parameter: { type: "select", options: ["PD-L1", "ER", "PR", "HER2", "Ki-67", "P53", "CK7", "CK20", "TTF-1", "PAX8", "GATA3", "CDX2", "PSA", "Other"] }, finding: { type: "text" }, source: { type: "select", options: ["Manual", "AI"] } } },
          genomic_testing_entries: { type: "text", isArray: true, itemFields: { parameter: { type: "select", options: ["Targeted NGS Panel", "Whole Exome Sequencing", "Whole Genome Sequencing", "Single-Gene Test", "FISH", "PCR", "Chromosomal / Cytogenetic Test", "Tumour Mutational Burden", "Other"] }, finding: { type: "text" }, source: { type: "select", options: ["Manual", "AI"] } } },
          gene_expression_profile_entries: { type: "text", isArray: true, itemFields: { parameter: { type: "select", options: ["Oncotype DX", "MammaPrint", "Prosigna / PAM50", "EndoPredict", "Intrinsic Subtype", "Risk Classification", "Other"] }, finding: { type: "text" }, source: { type: "select", options: ["Manual", "AI"] } } },
          molecular_markers_parameter: { type: "text" }, molecular_markers: { type: "text" },
          immunohistochemistry_parameter: { type: "text" }, immunohistochemistry: { type: "text" },
          genomic_testing_parameter: { type: "text" }, genomic_testing: { type: "text" },
          gene_expression_profile_parameter: { type: "text" }, gene_expression_profile: { type: "text" },
          viral_status_parameter: { type: "select", options: ["HPV", "EBV", "HBV", "HCV", "HHV-8", "HTLV-1", "Other"] },
          viral_status: { type: "text" },
        } },
      }
    },
    clinicalStaging: {
      key: "clinicalStaging", label: "Clinical Staging", tableKey: "clinicalStagingTable",
      fields: {
        clinicalStagingTable: { type: "text", isArray: true, itemFields: {
          staging_system: { type: "select", options: ["AJCC 8th Edition", "AJCC 7th Edition", "AJCC 6th Edition", "AJCC 9th Edition", "UICC TNM", "FIGO", "Ann Arbor", "Lugano", "Binet", "Rai", "ISS / R-ISS", "BCLC", "Child-Pugh", "Dukes", "Gleason Score / Grade Group", "NWTS / COG", "INSS", "INRG", "Masaoka-Koga", "WHO CNS Grade", "Chang", "IBLP", "HKLC", "Clark Level / Breslow Thickness"] },
          staging_type: { type: "select", options: ["Clinical", "Pathological", "Post-neoadjuvant", "Restaging", "Autopsy"] },
          staging_date: { type: "date" },
          staging_notes: { type: "text" },
          clinical_t: { type: "select", options: ["TX", "T0", "Tis", "T1", "T1a", "T1b", "T1c", "T1mi", "T2", "T2a", "T2b", "T3", "T3a", "T3b", "T4", "T4a", "T4b", "T4d"] },
          clinical_n: { type: "select", options: ["NX", "N0", "N0(i+)", "N0(mol+)", "N1", "N1a", "N1b", "N1c", "N1mi", "N2", "N2a", "N2b", "N2c", "N3", "N3a", "N3b", "N3c"] },
          clinical_m: { type: "select", options: ["cM0", "cM0(i+)", "cM1", "cM1a", "cM1b", "cM1c", "pM1"] },
          pathological_t: { type: "select", options: ["TX", "T0", "Tis", "T1", "T1a", "T1b", "T1c", "T1mi", "T2", "T2a", "T2b", "T3", "T3a", "T3b", "T4", "T4a", "T4b", "T4d"] },
          pathological_n: { type: "select", options: ["NX", "N0", "N0(i+)", "N0(mol+)", "N1", "N1a", "N1b", "N1c", "N1mi", "N2", "N2a", "N2b", "N2c", "N3", "N3a", "N3b", "N3c"] },
          pathological_m: { type: "select", options: ["cM0", "cM0(i+)", "pM1", "pM1a", "pM1b", "pM1c"] },
          clinical_stage_group: { type: "text" },
          pathological_stage_group: { type: "text" },
          figo_stage: { type: "select", options: ["I", "IA", "IA1", "IA2", "IB", "IB1", "IB2", "IC", "II", "IIA", "IIB", "IIC", "III", "IIIA", "IIIB", "IIIC", "IIIC1", "IIIC2", "IV", "IVA", "IVB"] },
          ann_arbor_stage: { type: "select", options: ["I", "IE", "II", "IIE", "III", "IIIE", "IIIS", "IIIES", "IV"] },
          ann_arbor_modifier: { type: "select", options: ["A", "B", "X"] },
          lugano_stage: { type: "select", options: ["Limited (I)", "Limited (II)", "Advanced (III)", "Advanced (IV)"] },
          lugano_modifier: { type: "select", options: ["A", "B", "Bulk disease"] },
          binet_stage: { type: "select", options: ["A", "B", "C"] },
          rai_stage: { type: "select", options: ["0", "I", "II", "III", "IV"] },
          child_pugh_grade: { type: "select", options: ["A (5-6 pts)", "B (7-9 pts)", "C (10-15 pts)"] },
          child_pugh_points: { type: "text" },
          bclc_stage: { type: "select", options: ["0 (Very early)", "A (Early)", "B (Intermediate)", "C (Advanced)", "D (Terminal)"] },
          dukes_stage: { type: "select", options: ["A", "B", "C1", "C2", "D"] },
          iss_stage: { type: "select", options: ["I", "II", "III"] },
          riss_stage: { type: "select", options: ["I", "II", "III"] },
          gleason_score: { type: "select", options: ["6 (3+3)", "7 (3+4)", "7 (4+3)", "8 (4+4)", "9 (4+5)", "9 (5+4)", "10 (5+5)"] },
          gleason_grade_group: { type: "select", options: ["1 (Gleason <= 6)", "2 (Gleason 3+4=7)", "3 (Gleason 4+3=7)", "4 (Gleason 8)", "5 (Gleason 9-10)"] },
          inss_stage: { type: "select", options: ["1", "2A", "2B", "3", "4", "4S"] },
          inrg_stage: { type: "select", options: ["L1", "L2", "M", "MS"] },
          nwts_stage: { type: "select", options: ["I", "II", "III", "IV", "V"] },
          masaoka_stage: { type: "select", options: ["I", "IIA", "IIB", "IIIA", "IIIB", "IVA", "IVB"] },
          who_cns_grade: { type: "select", options: ["1", "2", "3", "4"] },
          chang_stage: { type: "select", options: ["M0", "M1", "M2", "M3", "M4"] },
          iblp_stage: { type: "text" },
          hklc_stage: { type: "text" },
          clark_level: { type: "select", options: ["I", "II", "III", "IV", "V"] },
          breslow_thickness: { type: "text" },
        } },
      }
    },
    histologyGrading: {
      key: "histologyGrading", label: "Histology Grading", tableKey: "histologyGradingTable",
      fields: {
        histologyGradingTable: { type: "text", isArray: true, itemFields: {
          grading_system: { type: "select", options: ["Standard Histological Grade (G1-G4)", "Differentiation Grade", "Nuclear Grade (1-4)", "Nottingham (Elston-Ellis)", "Fuhrman Nuclear Grade", "ISUP Grade", "WHO/ISUP Grade", "Gleason Score / Grade Group", "FIGO Histological Grade", "WHO CNS Grade", "Lung Adenocarcinoma Pattern-Based", "GI / Pancreatobiliary Differentiation", "FNCLCC Sarcoma Grade"] },
          grading_date: { type: "date" },
          grading_notes: { type: "text" },
          histological_grade: { type: "select", options: ["Grade 1 (G1)", "Grade 2 (G2)", "Grade 3 (G3)", "Grade 4 (G4)", "Low Grade", "Intermediate Grade", "High Grade", "Not gradable", "Unknown"] },
          histological_grade_description: { type: "text" },
          differentiation: { type: "select", options: ["Well differentiated", "Moderately differentiated", "Poorly differentiated", "Undifferentiated", "Not specified"] },
          nuclear_grade: { type: "select", options: ["1 (Mild atypia)", "2 (Moderate atypia)", "3 (Severe atypia)", "4 (Anaplastic)"] },
          mitotic_count: { type: "text" },
          mitotic_score: { type: "select", options: ["1 (Low)", "2 (Intermediate)", "3 (High)"] },
          ki67_percentage: { type: "text" },
          lymphovascular_invasion: { type: "select", options: ["Absent", "Present", "Suspected", "Not assessed"] },
          perineural_invasion: { type: "select", options: ["Absent", "Present", "Suspected", "Not assessed"] },
          tumor_budding: { type: "select", options: ["Low (BD1)", "Intermediate (BD2)", "High (BD3)", "Not assessed"] },
          necrosis: { type: "select", options: ["Absent", "Present (focal)", "Present (extensive)", "Geographic necrosis"] },
          cellularity: { type: "select", options: ["Low", "Moderate", "High", "Very high"] },
          nottingham_score: { type: "text" },
          nottingham_grade: { type: "text" },
          nottingham_tubule_score: { type: "select", options: ["1 (>75% tubular)", "2 (10-75% tubular)", "3 (<10% tubular)"] },
          nottingham_nuclear_score: { type: "select", options: ["1 (Small, uniform nuclei)", "2 (Moderate variation)", "3 (Marked pleomorphism)"] },
          nottingham_mitotic_score: { type: "select", options: ["1 (Low mitotic rate)", "2 (Intermediate mitotic rate)", "3 (High mitotic rate)"] },
          fuhrman_grade: { type: "select", options: ["1", "2", "3", "4"] },
          isup_grade: { type: "select", options: ["1", "2", "3", "4"] },
          who_isup_grade: { type: "select", options: ["Low Grade (LG)", "High Grade (HG)"] },
          gleason_primary: { type: "select", options: ["3", "4", "5"] },
          gleason_secondary: { type: "select", options: ["3", "4", "5"] },
          gleason_score: { type: "select", options: ["6 (3+3)", "7 (3+4)", "7 (4+3)", "8 (4+4)", "9 (4+5)", "9 (5+4)", "10 (5+5)"] },
          gleason_grade_group: { type: "select", options: ["1 (<=6)", "2 (3+4=7)", "3 (4+3=7)", "4 (8)", "5 (9-10)"] },
          figo_grade: { type: "select", options: ["Grade 1", "Grade 2", "Grade 3"] },
          who_cns_grade: { type: "select", options: ["Grade 1", "Grade 2", "Grade 3", "Grade 4"] },
          lepidic_pattern: { type: "select", options: ["Absent", "Present"] },
          acinar_pattern: { type: "select", options: ["Absent", "Present"] },
          papillary_pattern: { type: "select", options: ["Absent", "Present"] },
          micropapillary_pattern: { type: "select", options: ["Absent", "Present"] },
          solid_pattern: { type: "select", options: ["Absent", "Present"] },
          tumor_differentiation: { type: "select", options: ["Well differentiated", "Moderately differentiated", "Poorly differentiated", "Undifferentiated"] },
          mucinous_component: { type: "select", options: ["Absent", "<50%", ">=50%", "Unknown"] },
          signet_ring_cells: { type: "select", options: ["Absent", "Present (focal)", "Present (extensive)", "Unknown"] },
          medullary_features: { type: "select", options: ["Absent", "Present", "Unknown"] },
          sarcoma_grade: { type: "select", options: ["Grade 1 -- Low (score 2-3)", "Grade 2 -- Intermediate (score 4-5)", "Grade 3 -- High (score 6-8)"] },
          mitoses_per_10hpf: { type: "text" },
          tumor_necrosis_percentage: { type: "number" },
        } },
      }
    },
    adjuvantTherapy: {
      key: "adjuvantTherapy", label: "Adjuvant Therapy", tableKey: "adjuvantTherapyTable",
      fields: {
        adjuvantTherapyTable: { type: "text", isArray: true, itemFields: {
          therapy_type: { type: "select", options: ["Adjuvant Chemotherapy", "Adjuvant Radiotherapy", "Other"] },
          date_of_commencement: { type: "date" },
          regimen: { type: "text" },
          cycles_dose: { type: "text" },
          details: { type: "text" },
          notes: { type: "text" },
        } },
      }
    },
    preOperativeAssessment: {
      key: "preOperativeAssessment", label: "Pre-Operative Assessment", tableKey: "preOperativeAssessmentTable",
      fields: {
        preOperativeAssessmentTable: { type: "text", isArray: true, itemFields: {
          surgery_name: { type: "text" }, assessment_date: { type: "date" },
          lab_hb: { type: "text" }, lab_wbc: { type: "text" }, lab_platelets: { type: "text" }, lab_creatinine: { type: "text" }, lab_egfr: { type: "text" }, lab_albumin: { type: "text" }, lab_inr: { type: "text" }, lab_aptt: { type: "text" }, lab_alt: { type: "text" }, lab_ast: { type: "text" }, lab_bilirubin: { type: "text" }, lab_crp: { type: "text" }, lab_troponin: { type: "text" }, lab_bnp: { type: "text" }, lab_blood_group: { type: "text" }, lab_other: { type: "text" },
          additional_labs: { type: "text", isArray: true, itemFields: { test_name: { type: "text" }, result: { type: "text" }, unit: { type: "text" }, reference_range: { type: "text" } } },
          additional_imaging: { type: "text", isArray: true, itemFields: { imaging_type: { type: "select", options: ["CT Chest/Abdomen/Pelvis", "CT Chest", "CT Abdomen/Pelvis", "MRI", "PET-CT", "PET-MRI", "Ultrasound", "Mammography", "Bone Scan", "X-Ray", "Other"] }, imaging_date: { type: "date" }, imaging_findings: { type: "text" } } },
          baseline_imaging_type: { type: "select", options: ["CT Chest/Abdomen/Pelvis", "CT Chest", "CT Abdomen/Pelvis", "MRI", "PET-CT", "PET-MRI", "Ultrasound", "Mammography", "Bone Scan", "X-Ray", "Other"] },
          baseline_imaging_date: { type: "date" }, baseline_imaging_findings: { type: "text" },
          surgical_candidacy: { type: "select", options: ["Candidate -- planned", "Candidate -- deferred", "Borderline candidate", "Not a candidate", "Under evaluation", "Already resected"] },
          surgical_candidacy_notes: { type: "text" },
          asa_class: { type: "select", options: ["ASA I", "ASA II", "ASA III", "ASA IV", "ASA V", "ASA VI"] },
          asa_notes: { type: "text" },
          margin_status_expectation: { type: "select", options: ["R0", "R1", "R2", "Unsure"] },
          margin_notes: { type: "text" },
          expected_resection_extent: { type: "select", options: ["Wide local excision", "Segmental resection", "Lobectomy", "Pneumonectomy", "Hemihepatectomy", "Whipple", "Total gastrectomy", "Partial gastrectomy", "Colectomy", "Total mesorectal excision", "Abdominoperineal resection", "Nephrectomy (radical)", "Nephrectomy (partial)", "Cystectomy (radical)", "Hysterectomy (radical)", "Hysterectomy (total)", "Maximal safe resection (CNS)", "Debulking", "Excisional biopsy", "Other"] },
          expected_resection_notes: { type: "text" },
          expected_lymphadenectomy: { type: "select", options: ["Sentinel node biopsy only", "Sampling (limited)", "Regional lymphadenectomy", "D2 lymphadenectomy", "D3 lymphadenectomy", "Pelvic lymph node dissection", "Para-aortic lymph node dissection", "Mediastinal lymph node dissection", "Cervical lymph node dissection", "Axillary lymph node dissection", "Inguinal lymph node dissection", "No lymphadenectomy planned"] },
          expected_lymph_node_levels: { type: "text" }, expected_lymph_node_count: { type: "text" },
          cardiac_assessment_status: { type: "select", options: ["Normal", "Known CAD -- stable", "Known CAD -- unstable", "Heart failure -- compensated", "Heart failure -- decompensated", "Arrhythmia -- controlled", "Arrhythmia -- uncontrolled", "Valvular disease -- mild", "Valvular disease -- moderate/severe", "Not assessed"] },
          cardiac_ecg_findings: { type: "text" }, cardiac_echo_findings: { type: "text" },
          cardiac_risk_stratification: { type: "select", options: ["Low risk (RCRI 0)", "Intermediate risk (RCRI 1-2)", "High risk (RCRI >= 3)", "Indeterminate"] },
          cardiac_clearance: { type: "select", options: ["Cleared for surgery", "Cleared with precautions", "Deferred", "Not cleared", "Not applicable"] },
          cardiac_notes: { type: "text" },
          rcri_high_risk_surgery: { type: "select", options: ["Yes", "No"] },
          rcri_ischemic_heart_disease: { type: "select", options: ["Yes", "No"] },
          rcri_heart_failure: { type: "select", options: ["Yes", "No"] },
          rcri_cerebrovascular_disease: { type: "select", options: ["Yes", "No"] },
          rcri_insulin_diabetes: { type: "select", options: ["Yes", "No"] },
          rcri_renal_dysfunction: { type: "select", options: ["Yes", "No"] },
          rcri_score_auto: { type: "readonly" }, cardiac_risk_manual: { type: "select", options: ["Manual"] },
          pulmonary_assessment_status: { type: "select", options: ["Normal pulmonary function", "COPD -- mild", "COPD -- moderate", "COPD -- severe", "Restrictive lung disease", "Asthma -- controlled", "Asthma -- uncontrolled", "OSA -- treated", "OSA -- untreated", "Not assessed"] },
          pulmonary_pft_findings: { type: "text" }, pulmonary_imaging_findings: { type: "text" },
          pulmonary_risk_stratification: { type: "select", options: ["Low risk", "Intermediate risk", "High risk", "Indeterminate"] },
          pulmonary_clearance: { type: "select", options: ["Cleared for surgery", "Cleared with precautions", "Deferred", "Not cleared", "Not applicable"] },
          pulmonary_notes: { type: "text" },
          pulm_age_risk: { type: "select", options: ["Yes", "No"] }, pulm_spo2_risk: { type: "select", options: ["Yes", "No"] }, pulm_upper_surgery: { type: "select", options: ["Yes", "No"] }, pulm_copd: { type: "select", options: ["Yes", "No"] }, pulm_smoking: { type: "select", options: ["Yes", "No"] }, pulm_emergency: { type: "select", options: ["Yes", "No"] },
          pulm_risk_score_auto: { type: "readonly" }, pulmonary_risk_manual: { type: "select", options: ["Manual"] },
          liver_assessment_status: { type: "select", options: ["Normal liver function", "Chronic liver disease -- compensated", "Chronic liver disease -- decompensated", "Cirrhosis -- compensated", "Cirrhosis -- decompensated", "Fatty liver / NAFLD", "Alcohol-related liver disease", "Hepatitis B -- carrier", "Hepatitis B -- active", "Hepatitis C -- treated", "Hepatitis C -- active", "Not assessed"] },
          liver_child_pugh_score: { type: "text" }, liver_child_pugh_grade: { type: "select", options: ["A (5-6 pts)", "B (7-9 pts)", "C (10-15 pts)"] },
          liver_meld_score: { type: "text" }, liver_meld_na_score: { type: "text" },
          liver_albi_grade: { type: "select", options: ["Grade 1 (<= -2.60)", "Grade 2 (> -2.60 to <= -1.39)", "Grade 3 (> -1.39)"] },
          liver_fibrosis_stage: { type: "select", options: ["F0", "F1", "F2", "F3", "F4"] },
          liver_steatosis: { type: "select", options: ["None", "Mild (<33%)", "Moderate (33-66%)", "Severe (>66%)"] },
          liver_portal_hypertension: { type: "select", options: ["Absent", "Mild", "Moderate", "Severe", "Not assessed"] },
          liver_notes: { type: "text" },
          cp_bilirubin: { type: "select", options: ["<2 mg/dL", "2-3 mg/dL", ">3 mg/dL"] },
          cp_albumin: { type: "select", options: [">3.5 g/dL", "2.8-3.5 g/dL", "<2.8 g/dL"] },
          cp_inr: { type: "select", options: ["<1.7", "1.7-2.3", ">2.3"] },
          cp_ascites: { type: "select", options: ["None", "Mild-Moderate", "Severe"] },
          cp_encephalopathy: { type: "select", options: ["None", "Grade 1-2", "Grade 3-4"] },
          cp_score_auto: { type: "readonly" }, cp_grade_auto: { type: "readonly" }, child_pugh_manual: { type: "select", options: ["Manual"] },
          kidney_assessment_status: { type: "select", options: ["Normal kidney function", "Acute kidney injury (AKI)", "Chronic kidney disease", "Solitary kidney", "Polycystic kidney disease", "Diabetic nephropathy", "Hypertensive nephropathy", "Obstructive uropathy", "Not assessed"] },
          kidney_ckd_stage: { type: "select", options: ["Stage 1", "Stage 2", "Stage 3a", "Stage 3b", "Stage 4", "Stage 5"] },
          kidney_egfr_category: { type: "select", options: ["G1 (>=90)", "G2 (60-89)", "G3a (45-59)", "G3b (30-44)", "G4 (15-29)", "G5 (<15)"] },
          kidney_rifle_stage: { type: "select", options: ["R", "I", "F", "L", "E"] },
          kidney_akin_stage: { type: "select", options: ["Stage 1", "Stage 2", "Stage 3"] },
          kidney_kdigo_stage: { type: "select", options: ["Stage 1", "Stage 2", "Stage 3"] },
          kidney_urine_acr: { type: "text" }, kidney_proteinuria: { type: "select", options: ["None / Trace", "Mild (1+)", "Moderate (2+)", "Severe (3+)", "Nephrotic range"] },
          kidney_notes: { type: "text" },
          metabolic_diabetes_status: { type: "select", options: ["No diabetes", "Type 1 -- controlled", "Type 1 -- uncontrolled", "Type 2 -- diet-controlled", "Type 2 -- oral agents", "Type 2 -- insulin", "Type 2 -- uncontrolled", "Prediabetes", "Unknown"] },
          metabolic_hba1c: { type: "text" },
          metabolic_nutritional_status: { type: "select", options: ["Well-nourished", "Mild malnutrition", "Moderate malnutrition", "Severe malnutrition", "Obese (BMI >= 30)", "Cachectic", "Not assessed"] },
          metabolic_risk_stratification: { type: "select", options: ["Low metabolic risk", "Intermediate metabolic risk", "High metabolic risk", "Indeterminate"] },
          metabolic_notes: { type: "text" }, metabolic_risk_manual: { type: "select", options: ["Manual"] },
          immunological_status: { type: "select", options: ["Immunocompetent", "Immunocompromised -- mild", "Immunocompromised -- moderate", "Immunocompromised -- severe", "Unknown"] },
          immunological_neutrophil_count: { type: "text" }, immunological_lymphocyte_count: { type: "text" },
          immunological_hiv_status: { type: "select", options: ["Negative", "Positive -- on ART, undetectable", "Positive -- on ART, detectable", "Positive -- not on ART", "Unknown"] },
          immunological_steroid_use: { type: "select", options: ["None", "Low dose (<10mg)", "Moderate dose (10-40mg)", "High dose (>40mg)", "Pulse steroids", "Inhaled steroids only"] },
          possum_phys_manual: { type: "select", options: ["Manual"] }, possum_op_manual: { type: "select", options: ["Manual"] },
          neoadj_chemo_received: { type: "select", options: ["Yes", "No", "Planned", "Not applicable"] },
          neoadj_chemo_response: { type: "select", options: ["Complete response (CR)", "Partial response (PR)", "Stable disease (SD)", "Progressive disease (PD)", "Pathologic CR (pCR)", "Major pathologic response (MPR)", "Not yet evaluated"] },
          neoadj_chemo_manual: { type: "select", options: ["Manual"] },
          neoadj_radio_received: { type: "select", options: ["Yes", "No", "Planned", "Not applicable"] },
          neoadj_radio_response: { type: "select", options: ["Complete response (CR)", "Partial response (PR)", "Stable disease (SD)", "Progressive disease (PD)", "Pathologic CR (pCR)", "Not yet evaluated"] },
          organ_resistance_testing: { type: "select", options: ["Performed", "Planned", "Not indicated", "Not available", "Declined"] },
          mdt_decision: { type: "select", options: ["Proceed with surgery", "Defer surgery -- neoadjuvant therapy first", "Defer surgery -- further workup needed", "Non-surgical management recommended", "Palliative care referral", "Awaiting further information"] },
        } },
      }
    },
    definitiveSurgery: {
      key: "definitiveSurgery", label: "Definitive Surgery", tableKey: "definitiveSurgeryTable",
      fields: {
        definitiveSurgeryTable: { type: "text", isArray: true, itemFields: {
          surgery_name: { type: "text" }, surgery_date: { type: "date" }, surgeon_name: { type: "text" }, surgeon_specialty: { type: "text" }, surgeon_volume: { type: "text" }, hospital_name: { type: "text" },
          surgery_type: { type: "select", options: ["Open", "Laparoscopic", "Robotic", "Endoscopic", "Percutaneous", "Hybrid", "Other"] },
          surgery_intent: { type: "select", options: ["Curative", "Palliative", "Diagnostic", "Prophylactic", "Other"] },
          surgery_phase: { type: "select", options: ["Primary", "Adjuvant", "Neoadjuvant", "Salvage", "Reoperation", "Staging", "Other"] },
          surgery_timing: { type: "select", options: ["Elective", "Urgent", "Emergency", "Salvage"] },
          preop_diagnosis: { type: "text" }, indication_for_surgery: { type: "text" },
          anesthesia_type: { type: "select", options: ["General", "Regional", "Local", "MAC", "Other"] },
          operative_duration_min: { type: "number" }, incision_to_closure: { type: "text" },
          estimated_blood_loss_ml: { type: "number" }, intraop_fluids_ml: { type: "number" },
          intraop_blood_transfusion: { type: "select", options: ["Yes", "No"] },
          intraop_complications: { type: "text" }, intraop_findings: { type: "text" }, specimen_description: { type: "text" },
          intraop_imaging: { type: "text" },
          intraop_imaging_list: { type: "text", isArray: true, itemFields: { imaging_type: { type: "text" }, imaging_findings: { type: "text" } } },
          surgery_approach: { type: "select", options: ["Open", "Laparoscopic", "Robotic", "Endoscopic", "Percutaneous", "Hybrid", "Other"] },
          surgery_site: { type: "text" }, procedure_details: { type: "text" },
          resection_status: { type: "select", options: ["R0", "R1", "R2", "R0 (microscopic)", "Not applicable"] },
          margin_status: { type: "select", options: ["Negative", "Positive", "Close", "Not assessed"] },
          closest_margin_mm: { type: "number" },
          lymph_node_dissection: { type: "select", options: ["D1", "D2", "D3", "Sentinel node", "Sampling", "None", "Not specified"] },
          lymph_node_harvested: { type: "number" }, lymph_node_positive: { type: "number" },
          organ_resection_details: { type: "text" },
          multi_visceral_resection: { type: "select", options: ["Yes", "No"] },
          sentinel_node_biopsy: { type: "select", options: ["Done", "Not done", "Failed"] },
          sentinel_node_biopsy_results: { type: "text" },
          neoadj_effect_details: { type: "text" },
          en_bloc_resection: { type: "select", options: ["Yes", "No"] },
          depth_of_invasion: { type: "text" }, resected_specimen_size: { type: "text" },
          conversion_to_open: { type: "select", options: ["No", "Yes (planned)", "Yes (unplanned)", "N/A"] },
          reconstruction_type: { type: "select", options: ["None", "Primary closure", "Flap", "Graft", "Anastomosis", "Stent", "Prosthesis", "Other"] },
          reconstruction_details: { type: "text" },
          postop_diagnosis: { type: "text" },
          recovery_status: { type: "select", options: ["Uncomplicated", "Minor complication", "Major complication", "ICU stay", "Deceased"] },
          discharge_date: { type: "date" },
          discharge_status: { type: "select", options: ["Home", "Rehabilitation", "Transfer", "Deceased", "AMA"] },
          readmission_30d: { type: "select", options: ["No", "Yes"] },
          readmission_reason: { type: "text" },
          pathology_specimen_id: { type: "text" }, pathology_link: { type: "text" }, surgery_notes: { type: "text" },
        } },
      }
    },
    treatmentOutcome: {
      key: "treatmentOutcome", label: "Treatment Outcome", tableKey: "treatmentOutcomeTable",
      fields: {
        treatmentOutcomeTable: { type: "text", isArray: true, itemFields: {
          assessment_date: { type: "date" },
          response_evaluation_criteria: { type: "select", options: ["RECIST 1.1", "iRECIST", "RANO", "PERCIST", "Deauville", "Lugano", "Not specified"] },
          overall_response: { type: "select", options: ["CR", "PR", "SD", "PD", "Mixed", "Not evaluable"] },
          target_lesion_response: { type: "text" }, non_target_lesion_response: { type: "text" },
          new_lesions: { type: "select", options: ["No", "Yes"] },
          progression_date: { type: "date" },
          recurrence_status: { type: "select", options: ["No recurrence", "Local", "Regional", "Distant", "Unknown"] },
          recurrence_date: { type: "date" }, recurrence_location: { type: "text" },
          survival_status: { type: "select", options: ["Alive", "Deceased", "Unknown"] },
          survival_date: { type: "date" }, cause_of_death: { type: "text" },
          ecog_status: { type: "select", options: ["0", "1", "2", "3", "4", "5"] },
          tumor_markers_followup: { type: "text" }, imaging_followup: { type: "text" }, outcome_notes: { type: "text" },
          hospital_entry_date: { type: "date" }, hospital_exit_date: { type: "date" }, hospital_stay_days: { type: "text" },
          icu_admission: { type: "select", options: ["Yes", "No"] },
          icu_admit_date: { type: "date" }, icu_exit_date: { type: "date" }, icu_stay_days: { type: "text" },
          return_to_or_30d: { type: "select", options: ["No", "Yes"] },
          transfusion_needed: { type: "select", options: ["No", "Yes"] }, transfusion_type: { type: "text" }, transfusion_amount: { type: "text" },
          wound_infection: { type: "select", options: ["No", "Superficial", "Deep", "Organ/space"] },
          anastomotic_leak: { type: "select", options: ["No", "Grade A", "Grade B", "Grade C", "Yes (not graded)"] },
          thromboembolic_events: { type: "select", options: ["No", "DVT", "PE", "Both"] },
          cardiac_complication: { type: "select", options: ["No", "Yes"] }, cardiac_complication_details: { type: "text" },
          pulmonary_complication: { type: "select", options: ["No", "Yes"] }, pulmonary_complication_details: { type: "text" },
          acute_kidney_injury: { type: "select", options: ["No", "Stage 1", "Stage 2", "Stage 3"] },
          hepatic_dysfunction: { type: "select", options: ["No", "Yes"] },
          anastomotic_stricture: { type: "select", options: ["No", "Yes"] },
          lymphoedema: { type: "select", options: ["No", "Yes"] },
          seroma_hematoma: { type: "select", options: ["No", "Seroma", "Hematoma", "Both"] },
          nerve_injury: { type: "select", options: ["No", "Yes"] },
          fistula_formation: { type: "select", options: ["No", "Yes"] },
          sepsis_development: { type: "select", options: ["No", "Sepsis", "Severe sepsis", "Septic shock"] },
          mortality_30d: { type: "select", options: ["No", "Yes"] },
          mortality_90d: { type: "select", options: ["No", "Yes"] },
          mortality_1y: { type: "select", options: ["No", "Yes"] },
          unplanned_readmission: { type: "select", options: ["No", "Yes"] },
          discharge_destination: { type: "select", options: ["Home", "Rehabilitation", "Transfer", "Deceased", "Other"] },
          clavien_dindo_grade: { type: "select", options: ["I", "II", "IIIa", "IIIb", "IVa", "IVb", "V"] },
          clavien_dindo_criteria: { type: "text" }, severe_complication_rate_criteria: { type: "text" },
          icu_management_details: { type: "text" }, ward_management_details: { type: "text" },
          postop_monitoring: { type: "text", isArray: true, itemFields: { postop_day: { type: "text" }, date: { type: "date" }, parameters: { type: "text", isArray: true, itemFields: { parameter: { type: "text" }, finding: { type: "text" } } } } },
          postop_complications: { type: "text", isArray: true, itemFields: { complication_name: { type: "text" }, occurrence_date: { type: "date" }, days_postop: { type: "text" } } },
          reference_surgery_date: { type: "date" },
        } },
      }
    },
    afterSurgicalTherapies: {
      key: "afterSurgicalTherapies", label: "After Surgical Therapies", tableKey: "afterSurgicalTherapiesTable",
      fields: {
        afterSurgicalTherapiesTable: { type: "text", isArray: true, itemFields: {
          therapy_type: { type: "select", options: ["Adjuvant Chemotherapy", "Adjuvant Radiotherapy", "Hormonal Therapy", "Immunotherapy", "Targeted Therapy", "Other"] },
          start_date: { type: "date" }, end_date: { type: "date" },
          regimen: { type: "text" }, cycles_dose: { type: "text" }, details: { type: "text" }, notes: { type: "text" },
          diagnosis_date_ref: { type: "date" }, first_therapy_date: { type: "date" }, days_diag_to_therapy: { type: "text" },
          chemo_dose_intensity: { type: "text" },
          chemo_toxicity_grade: { type: "select", options: ["Grade 0", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"] },
          radiation_dose_modifications: { type: "text" },
          treatment_adherence: { type: "select", options: ["Full adherence", "Partial adherence", "Non-adherence", "Interrupted", "Discontinued"] },
          treatment_related_mortality: { type: "select", options: ["No", "Yes", "Suspected"] },
          late_toxicity: { type: "text" },
        } },
      }
    },
    followUpPrognosis: {
      key: "followUpPrognosis", label: "Follow-up and Prognosis", tableKey: "followUpPrognosisTable",
      fields: {
        followUpPrognosisTable: { type: "text", isArray: true, itemFields: {
          second_cancer_development: { type: "select", options: ["No", "Yes"] }, second_cancer_details: { type: "text" },
          cancer_specific_survival: { type: "text" }, conditional_survival_details: { type: "text" },
          qol_assessment_done: { type: "select", options: ["Yes", "No"] },
          qol_score_system: { type: "select", options: ["EORTC QLQ-C30", "FACT-G", "SF-36", "EQ-5D", "WHOQOL-BREF", "Other"] },
          qol_parameters: { type: "text" }, qol_score: { type: "text" },
          functional_recovery: { type: "text" },
          genetic_review_done: { type: "select", options: ["Yes", "No", "Pending"] }, genetic_review_details: { type: "text" },
          clinical_trial_enrollment: { type: "select", options: ["No", "Yes", "Offered, declined"] }, clinical_trial_details: { type: "text" },
          readmission_30d: { type: "select", options: ["No", "Yes"] },
          readmission_90d: { type: "select", options: ["No", "Yes"] },
          follow_up_notes: { type: "textarea" },
        } },
      }
    },
    oncologicalOutcome: {
      key: "oncologicalOutcome", label: "Oncological Outcome", tableKey: "oncologicalOutcomeTable",
      fields: {
        oncologicalOutcomeTable: { type: "text", isArray: true, itemFields: {
          assessment_date: { type: "date" },
          response_evaluation_criteria: { type: "select", options: ["RECIST 1.1", "iRECIST", "RANO", "PERCIST", "Deauville", "Lugano", "Not specified"] },
          overall_response: { type: "select", options: ["CR", "PR", "SD", "PD", "Mixed", "Not evaluable"] },
          target_lesion_response: { type: "text" }, non_target_lesion_response: { type: "text" },
          new_lesions: { type: "select", options: ["No", "Yes"] },
          progression_date: { type: "date" },
          recurrence_status: { type: "select", options: ["No recurrence", "Local", "Regional", "Distant", "Unknown"] },
          recurrence_date: { type: "date" }, recurrence_location: { type: "text" },
          survival_status: { type: "select", options: ["Alive", "Deceased", "Unknown"] },
          survival_date: { type: "date" }, cause_of_death: { type: "text" },
          ecog_status: { type: "select", options: ["0", "1", "2", "3", "4", "5"] },
          tumor_markers_followup: { type: "text" }, imaging_followup: { type: "text" }, outcome_notes: { type: "text" },
        } },
      }
    },
    treatments: {
      key: "treatments", label: "Treatments",
      fields: {
        neo_chemo_status: { type: "select", options: ["Done", "Not done", "Planned"] },
        neoChemoTable: { type: "text", isArray: true, itemFields: { neo_chemo_drug: { type: "text" }, neo_chemo_dose: { type: "text" }, neo_chemo_freq: { type: "text" }, neo_chemo_route: { type: "text" }, neo_chemo_cycles: { type: "text" }, neo_chemo_effects: { type: "text" }, neo_chemo_notes: { type: "text" } } },
        adj_chemo_status: { type: "select", options: ["Done", "Not done", "Planned"] },
        adjChemoTable: { type: "text", isArray: true, itemFields: { neo_chemo_drug: { type: "text" }, neo_chemo_dose: { type: "text" }, neo_chemo_freq: { type: "text" }, neo_chemo_route: { type: "text" }, neo_chemo_cycles: { type: "text" }, neo_chemo_effects: { type: "text" }, neo_chemo_notes: { type: "text" } } },
        neo_radio_status: { type: "select", options: ["Done", "Not done", "Planned"] },
        neoRadioTable: { type: "text", isArray: true, itemFields: { neo_radio_comp: { type: "text" }, neo_radio_dose: { type: "text" }, neo_radio_freq: { type: "text" }, neo_radio_route: { type: "text" }, neo_radio_cycles: { type: "text" }, neo_radio_effects: { type: "text" }, neo_radio_notes: { type: "text" } } },
        adj_radio_status: { type: "select", options: ["Done", "Not done", "Planned"] },
        adjRadioTable: { type: "text", isArray: true, itemFields: { neo_radio_comp: { type: "text" }, neo_radio_dose: { type: "text" }, neo_radio_freq: { type: "text" }, neo_radio_route: { type: "text" }, neo_radio_cycles: { type: "text" }, neo_radio_effects: { type: "text" }, neo_radio_notes: { type: "text" } } },
      }
    },
    surgicalProcedures: {
      key: "surgicalProcedures", label: "Surgical Procedures",
      fields: {
        surgeryTable: { type: "text", isArray: true, itemFields: { surgery_name: { type: "text" }, surgery_date: { type: "date" }, surgery_site: { type: "text" }, surgery_approach: { type: "text" }, surgery_findings: { type: "text" }, drain_status: { type: "select", options: ["In situ", "Removed", "Not placed"] }, drain_volume: { type: "text" }, surgery_notes: { type: "text" } } },
        complicationTable: { type: "text", isArray: true, itemFields: { complication: { type: "text" }, post_op_duration: { type: "text" }, management: { type: "text" }, notes: { type: "text" } } },
        monitoringTable: { type: "text", isArray: true, itemFields: { monitor_param: { type: "text" }, monitor_duration: { type: "text" }, monitor_findings: { type: "text" }, monitor_notes: { type: "text" } } },
        icu_done: { type: "select", options: ["Done", "Not done"] },
        icuTable: { type: "text", isArray: true, itemFields: { icu_date: { type: "date" }, icu_stay: { type: "text" }, icu_mgmt: { type: "text" }, icu_exit: { type: "text" }, icu_notes: { type: "text" } } },
        wardTable: { type: "text", isArray: true, itemFields: { ward_entry: { type: "date" }, ward_stay: { type: "text" }, ward_mgmt: { type: "text" }, ward_exit: { type: "text" }, ward_notes: { type: "text" } } },
      }
    },
    care: {
      key: "care", label: "Care / Plan",
      fields: {
        problemTable: { type: "text", isArray: true, itemFields: { problem: { type: "text" }, management_plan: { type: "text" } } },
        commonDrugsTable: { type: "text", isArray: true, itemFields: { common_drug: { type: "text" }, common_dose: { type: "text" }, common_frequency: { type: "text" }, common_drug_notes: { type: "text" } } },
        follow_up_notes: { type: "textarea" },
        general_notes: { type: "textarea" },
      }
    },
    extraParams: {
      key: "extraParams", label: "AI Added Extra Parameters",
      fields: {
        unmapped_medical_information: { type: "text", isArray: true, itemFields: { source_section: { type: "text" }, detail: { type: "text" }, medical_importance: { type: "select", options: ["low", "medium", "high"] } } },
        extraction_safety_note: { type: "textarea" },
      }
    },
    supplementary: {
      key: "supplementary", label: "Supplementary Details",
      fields: {
        supplementaryDetailsTable: { type: "text", isArray: true, itemFields: { detail_heading: { type: "text" }, detail_subheading: { type: "text" }, detail_label: { type: "text" }, detail_value: { type: "text" }, detail_unit: { type: "text" }, detail_date: { type: "date" }, detail_priority: { type: "select", options: ["low", "medium", "high"] }, detail_category: { type: "text" }, detail_source: { type: "text" }, detail_notes: { type: "text" } } },
        source_file_summaries: { type: "text", isArray: true, itemFields: { file_name: { type: "text" }, document_type: { type: "text" }, clinically_relevant_summary: { type: "textarea" }, unclear_or_unreadable_parts: { type: "textarea" } } },
      }
    },
    documentExtractions: {
      key: "documentExtractions", label: "Document AI Fill Backups",
      fields: {
        document_extraction_backups: { type: "text", isArray: true, itemFields: { document_name: { type: "text" }, extraction_date: { type: "date" }, extraction_time: { type: "text" }, raw_extracted_data: { type: "textarea" }, file_reference: { type: "text" } } },
      }
    },
  }
};

export function getSectionFieldKeys(_sectionKey: string): string[] {
  const section = MANIFEST.sections[_sectionKey];
  if (!section) return [];

  const keys = new Set<string>();
  const addFieldKeys = (fieldKey: string, field: ManifestField) => {
    keys.add(fieldKey);
    for (const [itemKey, itemField] of Object.entries(field.itemFields || {})) {
      keys.add(itemKey);
      if (itemField.itemFields) addFieldKeys(itemKey, itemField);
    }
  };

  for (const [fieldKey, field] of Object.entries(section.fields)) {
    addFieldKeys(fieldKey, field);
  }

  return Array.from(keys);
}

export function getFieldManifest(sectionKey: string, tableKey?: string): ManifestField | undefined {
  const section = MANIFEST.sections[sectionKey];
  if (!section) return;
  const key = tableKey || section.tableKey;
  if (key && section.fields[key]) return section.fields[key];
  return;
}

export function generateSchemaPrompt(): string {
  const lines: string[] = [];
  lines.push("Return ONLY one JSON object using these exact top-level keys.");
  lines.push("For array fields, create as many rows as needed — never limit to one row.");
  lines.push("Use ONLY the allowed option values listed for select-type fields.");
  lines.push("Do NOT invent data not present in the document.");
  lines.push("");
  lines.push("CRITICAL: Do NOT use supplementaryDetailsTable for data that fits into any predefined field below. supplementaryDetailsTable is a last-resort-only section for data that has no other home. Map every value to its most specific predefined field first.");
  lines.push("");

  const SKIP_SECTIONS = new Set(["documentExtractions"]);

  for (const [sectionKey, section] of Object.entries(MANIFEST.sections)) {
    if (SKIP_SECTIONS.has(sectionKey)) continue;
    lines.push(`// === ${section.label} (${sectionKey}) ===`);
    for (const [fieldKey, field] of Object.entries(section.fields)) {
      if (field.isArray) {
        const itemFields = field.itemFields || {};
        const fieldNames = Object.keys(itemFields);
        const fieldTypes = fieldNames.map(n => {
          const f = itemFields[n];
          if (f.type === "select" && f.options) return `${n}: string (one of: ${f.options.join(", ")})`;
          if (f.isArray) return `${n}: array of { ${Object.keys(f.itemFields || {}).join(", ")} }`;
          return `${n}: ${f.type}`;
        });
        lines.push(`"${fieldKey}": array of { ${fieldTypes.join("; ")} }`);
      } else {
        if (field.type === "select" && field.options) {
          lines.push(`"${fieldKey}": string (one of: ${field.options.join(", ")})`);
        } else {
          lines.push(`"${fieldKey}": ${field.type}`);
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function getAllFormKeys(): string[] {
  const keys: string[] = [];
  for (const section of Object.values(MANIFEST.sections)) {
    for (const fieldKey of Object.keys(section.fields)) {
      keys.push(fieldKey);
    }
  }
  return keys;
}

export function buildTableTemplates(): Record<string, Record<string, any>> {
  const templates: Record<string, Record<string, any>> = {};
  for (const section of Object.values(MANIFEST.sections)) {
    for (const [fieldKey, field] of Object.entries(section.fields)) {
      if (!field.isArray) continue;
      const template: Record<string, any> = {};
      const buildDefaults = (itemFields: Record<string, ManifestField> | undefined): Record<string, any> => {
        const obj: Record<string, any> = {};
        if (!itemFields) return obj;
        for (const [name, f] of Object.entries(itemFields)) {
          if (f.isArray) {
            obj[name] = [];
          } else {
            obj[name] = "";
          }
        }
        return obj;
      };
      if (field.itemFields) {
        Object.assign(template, buildDefaults(field.itemFields));
        for (const [name, f] of Object.entries(field.itemFields)) {
          if (f.isArray && f.itemFields) {
            template[name] = [];
          }
        }
      }
      templates[fieldKey] = template;
    }
  }
  return templates;
}

export function getExportKeyOrder(): string[] {
  const keys: string[] = [];
  for (const [, section] of Object.entries(MANIFEST.sections)) {
    for (const fieldKey of Object.keys(section.fields)) {
      keys.push(fieldKey);
    }
  }
  keys.push("createdAt", "updatedAt", "isDeleted");
  return keys;
}

export default MANIFEST;
