These are the endpoints flutter needs to use in order to upload data to backend

(POST)

/api/beneficiaries
REQ BODY:
{
  "firstName": "string",
  "lastName": "string",
  "dob": "2025-10-14",
  "nationalId": "string",
  "phone": "string",
  "email": "user@example.com",
  "address": "string",
  "gender": "M",
  "municipality": "string",
  "nationality": "string",
  "ethnicity": "string",
  "residence": "Rural",
  "householdMembers": 0,
  "status": "active",
  "details": {
    "additionalProp1": {}
  }
}

RESPONSE:
{status: ok}


/api/beneficiaries/{id}/entities
REQ:
[
   "id": "beneficiaryId" 
  {
    "entityId": "11111111-1111-1111-1111-111111111111",
    "entityType": "project"
  },
  {
    "entityId": "22222222-2222-2222-2222-222222222222",
    "entityType": "subproject"
  }
]


/forms/templates/{id}/responses

REQ:
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "templateId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "entityId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "entityType": "project",
  "data": {},
  "latitude": 0,
  "longitude": 0,
  "beneficiaryId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "services": [
    {
      "serviceId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "deliveredAt": "2025-10-14T18:57:10.702Z",
      "staffUserId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "notes": "string"
    }
  ]
}