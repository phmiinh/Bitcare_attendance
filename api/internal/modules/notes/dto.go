package notes

// GET /api/v1/notes/me?date=

type GetMeResponse struct {
	WorkDate string `json:"workDate"`
	Content  string `json:"content"`
}

// PUT /api/v1/notes/me?date=

type PutMeRequest struct {
	Content string `json:"content"`
}

type PutMeResponse struct {
	WorkDate   string `json:"workDate"`
	Content    string `json:"content"`
	UpdatedAt  string `json:"updatedAt"`
}

