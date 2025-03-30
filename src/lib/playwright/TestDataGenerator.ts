/**
 * Utility class for generating test data for form fields
 */
export class TestDataGenerator {
  /**
   * Generate a random name
   */
  static generateName(): string {
    const firstNames = [
      'John', 'Jane', 'Alex', 'Sarah', 'Michael', 'Emma', 'David', 'Olivia', 
      'James', 'Sophia', 'Robert', 'Ava', 'William', 'Emily', 'Joseph', 'Mia'
    ];
    
    const lastNames = [
      'Smith', 'Johnson', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez',
      'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor'
    ];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    return `${firstName} ${lastName}`;
  }
  
  /**
   * Generate a random email
   */
  static generateEmail(): string {
    const name = this.generateName().replace(' ', '.').toLowerCase();
    const domains = ['example.com', 'test.com', 'demo.org', 'sample.net'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    
    return `${name}@${domain}`;
  }
  
  /**
   * Generate a random company name
   */
  static generateCompanyName(): string {
    const prefixes = [
      'Tech', 'Global', 'Digital', 'Smart', 'Future', 'Next', 'Modern', 'Advanced',
      'Prime', 'Elite', 'Superior', 'Innovative', 'Creative', 'Dynamic', 'Progressive'
    ];
    
    const suffixes = [
      'Systems', 'Solutions', 'Technologies', 'Innovations', 'Enterprises', 'Group',
      'Corp', 'Inc', 'Industries', 'Partners', 'Associates', 'Services', 'Consulting'
    ];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    return `${prefix} ${suffix}`;
  }
  
  /**
   * Generate a random phone number
   */
  static generatePhoneNumber(): string {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const prefix = Math.floor(Math.random() * 900) + 100;
    const lineNumber = Math.floor(Math.random() * 9000) + 1000;
    
    return `${areaCode}${prefix}${lineNumber}`;
  }
  
  /**
   * Generate a random job title
   */
  static generateJobTitle(): string {
    const positions = [
      'CEO', 'CTO', 'CFO', 'COO', 'Manager', 'Director', 'VP', 'Lead',
      'Senior Engineer', 'Product Manager', 'Marketing Director', 'Sales Manager',
      'Head of Operations', 'Chief Strategist', 'Principal Consultant'
    ];
    
    return positions[Math.floor(Math.random() * positions.length)];
  }
} 