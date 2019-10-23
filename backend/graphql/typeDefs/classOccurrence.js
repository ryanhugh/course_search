import { gql } from 'apollo-server';

const typeDef = gql`
  type ClassOccurrence {
    name: String!
    subject: String!
    classId: Int!
    termId: Int!

    desc: String
    prereqs: JSON
    coreqs: JSON
  }
`;

export default typeDef;
