CREATE DATABASE IF NOT EXISTS `{{ project_web }}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    topic VARCHAR(255),  
    landline VARCHAR(20),
    mobile VARCHAR(20),
    department VARCHAR(100),
    university VARCHAR(150),
    role ENUM('student', 'professor', 'secretariat') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE thesis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    description_pdf_url VARCHAR(500),
    status ENUM('under_assignment', 'active', 'under_review', 'completed', 'cancelled') NOT NULL DEFAULT 'under_assignment',
    supervison_id INT NOT NULL,
    student_id INT NOT NULL,
    gs_approval_protocol VARCHAR(100),
    assignment_date DATE,
    cancellation_reason TEXT,
    presentation_date DATETIME,
    presentation_location VARCHAR(255),
    grade INT CHECK (grade BETWEEN 0 AND 10),
    repository_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supervison_id) REFERENCES users(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
);

CREATE TABLE thesis_files (
    id INT PRIMARY KEY AUTO_INCREMENT,
    thesis_id INT NOT NULL,
    uploader_id INT NOT NULL, 
    file_type ENUM('draft', 'video', 'image', 'code', 'pdf', 'other') DEFAULT 'other',
    file_url_or_path VARCHAR(500) NOT NULL,
    description TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id),
    FOREIGN KEY (uploader_id) REFERENCES users(id)
);


CREATE TABLE Committee_Invitations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    thesis_id INT NOT NULL,
    invited_professor_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'declined') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_date TIMESTAMP NULL,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id),
    FOREIGN KEY (invited_professor_id) REFERENCES users(id)
);

CREATE TABLE Committee_Members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    thesis_id INT NOT NULL,
    professor_id INT NOT NULL,
    role ENUM('supervisor', 'member') NOT NULL,
    grade INT CHECK (grade BETWEEN 0 AND 10),
    grade_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id),
    FOREIGN KEY (professor_id) REFERENCES users(id)
);

CREATE TABLE Progress_Notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    thesis_id INT NOT NULL,
    author_id INT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thesis_id) REFERENCES thesis(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
);