package auth

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email,max=190"`
	Password string `json:"password" validate:"required"`
}

type LoginUser struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type LoginResponse struct {
	User LoginUser `json:"user"`
}
